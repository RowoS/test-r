import { useState } from 'react'
import { postComment } from '@/lib/ticket-actions'

export function useCommentForm(ticketId: string) {
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!body.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Business Logic: Trigger server action for comment creation
      await postComment(ticketId, body, isInternal)
      
      // Reset form state on success
      setBody('')
      setIsInternal(false)
    } catch (err: any) {
      setError(err.message || 'Failed to post comment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    body,
    setBody,
    isInternal,
    setIsInternal,
    isSubmitting,
    error,
    handleSubmit
  }
}