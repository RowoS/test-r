'use client'

import { useCommentForm } from '@/lib/hooks/useCommentForm'

export type CommentRow = {
  id: string
  body: string
  is_internal: boolean
  created_at: string
  user: { full_name: string } | null
}

interface TicketCommentsProps {
  ticketId: string
  comments: CommentRow[]
}

export function TicketComments({ ticketId, comments }: TicketCommentsProps) {
  const { 
    body, 
    setBody, 
    isInternal, 
    setIsInternal, 
    isSubmitting, 
    error, 
    handleSubmit 
  } = useCommentForm(ticketId)

  return (
    <div className="flex flex-col space-y-6">
      {/* Presentation: Comment Thread */}
      <div className="flex flex-col space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div 
              key={comment.id} 
              className={`p-4 rounded-lg border ${
                comment.is_internal 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  {comment.user?.full_name || 'Unknown User'}
                </span>
                <div className="flex items-center space-x-2">
                  {comment.is_internal && (
                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-yellow-200 text-yellow-800 rounded-sm">
                      Internal
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))
        )}
      </div>

      {/* Presentation: Comment Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col space-y-3 pt-4 border-t border-gray-100">
        {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        
        <textarea
          rows={3}
          className="border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:opacity-50"
          placeholder="Add a comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isSubmitting}
        />
        
        <div className="flex justify-between items-center">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              disabled={isSubmitting}
            />
            <span className="text-sm text-gray-700">Internal note (hidden from requester)</span>
          </label>
          
          <button
            type="submit"
            disabled={isSubmitting || !body.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>
    </div>
  )
}