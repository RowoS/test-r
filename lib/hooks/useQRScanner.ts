'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export type QrScannerError =
  | 'insecure-context'
  | 'no-camera-support'
  | 'permission-denied'
  | 'no-camera-found'
  | 'camera-in-use'
  | 'unknown';

interface UseQrScannerOptions {
  /** Called once per newly-decoded value. Won't fire again for the same
   *  value until `reset()` is called — prevents re-submitting on every
   *  frame while the code is still in view. */
  onDecode: (value: string) => void;
  /** Skip every Nth frame to keep the main thread responsive on lower-end
   *  phones. 2 = check every other frame. */
  frameSkip?: number;
}

interface UseQrScannerResult {
  // Fix 2: Allow the RefObject to accept null to match the useRef initialization
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  error: QrScannerError | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Call after handling a decoded value (success or failure) to allow the
   *  same code to be detected again. */
  reset: () => void;
}

export function useQrScanner({ onDecode, frameSkip = 2 }: UseQrScannerOptions): UseQrScannerResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastDecodedRef = useRef<string | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<QrScannerError | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsActive(false);
  }, []);

  const tickRef = useRef<() => void>(() => {});

  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(() => tickRef.current());
      return;
    }

    frameCountRef.current += 1;
    if (frameCountRef.current % frameSkip !== 0) {
      rafRef.current = requestAnimationFrame(() => tickRef.current());
      return;
    }

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx && canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (result?.data && result.data !== lastDecodedRef.current) {
        lastDecodedRef.current = result.data;
        onDecode(result.data);
      }
    }

    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }, [frameSkip, onDecode]);

  // Fix 1: Sync the latest tick closure inside a useEffect to keep renders pure
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const start = useCallback(async () => {
    setError(null);

    if (typeof window === 'undefined' || !window.isSecureContext) {
      setError('insecure-context');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('no-camera-support');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    } catch (err) {
      const name = err instanceof DOMException ? err.name : 'unknown';
      if (name === 'NotAllowedError' || name === 'SecurityError') setError('permission-denied');
      else if (name === 'NotFoundError') setError('no-camera-found');
      else if (name === 'NotReadableError') setError('camera-in-use');
      else setError('unknown');
    }
  }, []);

  const reset = useCallback(() => {
    lastDecodedRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, isActive, error, start, stop, reset };
}