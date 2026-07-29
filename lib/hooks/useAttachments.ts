import { useState } from 'react'
import { uploadAttachment, deleteAttachment } from '@/lib/ticket-actions'

export function useAttachments(ticketId: string) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      // Business Logic: Triggers server action for file upload[cite: 4]
      await uploadAttachment(ticketId, formData)
    } catch (err: any) {
      setError(err.message || 'Failed to upload attachment.')
    } finally {
      setIsUploading(false)
      // Reset the file input
      e.target.value = ''
    }
  }

  const handleDelete = async (attachmentId: string, storagePath: string) => {
    setIsDeleting(attachmentId)
    setError(null)

    try {
      await deleteAttachment(ticketId, attachmentId, storagePath)
    } catch (err: any) {
      setError(err.message || 'Failed to delete attachment.')
    } finally {
      setIsDeleting(null)
    }
  }

  return {
    isUploading,
    isDeleting,
    error,
    handleUpload,
    handleDelete
  }
}