'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDraftTicket } from '@/lib/ticket-actions'
import { EmployeeLookup } from '@/components/EmployeeLookup'
import { CategorySelector } from '@/components/CategorySelector'

export function TicketForm() {
  const router = useRouter()
  
  // Track resolved states to validate before submission
  const [resolvedEmployeeId, setResolvedEmployeeId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

const handleSubmit = async (formData: FormData) => {
  setIsSubmitting(true)
  setError(null)

  try {
    if (!resolvedEmployeeId) {
      throw new Error('Please ensure a valid active requester is found before submitting.')
    }
    if (!selectedCategoryId) {
      throw new Error('Please select a valid ticket category.')
    }

    formData.set('category_id', selectedCategoryId)
    
    // Create draft ticket landing in 'pending_confirmation' status
    const ticket = await createDraftTicket(formData)
    
    // Extract the ID safely, handling if the server action returned an array by mistake
    const ticketId = ticket?.id || (Array.isArray(ticket) ? ticket[0]?.id : null)

    if (!ticketId) {
      console.error("Server returned:", ticket)
      throw new Error('Ticket drafted successfully, but the server failed to return the Ticket ID.')
    }
    
    // Route using the validated ID
    router.push(`/tickets/pending/${ticketId}`)
  } catch (err: any) {
    setError(err.message || 'An unexpected error occurred.')
    setIsSubmitting(false)
  }
}

  return (
    <form action={handleSubmit} className="flex flex-col space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-semibold text-gray-800">Requester Information</h2>
        <div className="mt-4">
          <EmployeeLookup 
            onEmployeeFound={(id) => setResolvedEmployeeId(id)} 
          />
          {/* Note: Ensure the input in EmployeeLookup has name="employee_no" for FormData extraction */}
        </div>
      </div>

      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-semibold text-gray-800">Ticket Details</h2>
        
        <div className="mt-4 space-y-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="title" className="text-sm font-medium text-gray-700">Title</label>
            <input
              id="title"
              name="title"
              type="text"
              required
              className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Brief summary of the issue..."
            />
          </div>

          <div className="flex flex-col space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Detailed explanation..."
            />
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-lg font-semibold text-gray-800">Classification</h2>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategorySelector 
            onCategorySelected={(id) => setSelectedCategoryId(id)} 
          />

          <div className="flex flex-col space-y-2">
            <label htmlFor="priority" className="text-sm font-medium text-gray-700">Priority (Optional)</label>
            <select
              id="priority"
              name="priority"
              className="border border-gray-300 rounded-md p-2 bg-white h-10.5"
              defaultValue="medium"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !resolvedEmployeeId || !selectedCategoryId}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Creating Draft...' : 'Create Draft Ticket'}
        </button>
      </div>
    </form>
  )
}