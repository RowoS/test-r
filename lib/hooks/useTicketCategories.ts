import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type TicketCategory = {
  id: string
  name: string
  code: string
  parent_id: string | null
}

export function useTicketCategories() {
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true)
      
      const { data, error: fetchError } = await supabase
        .from('ticket_categories')
        .select('id, name, code, parent_id')
        .order('name')

      if (fetchError) {
        setError('Failed to load categories')
      } else if (data) {
        setCategories(data)
      }
      
      setIsLoading(false)
    }

    fetchCategories()
  }, [supabase])

  // Business Logic: Derived state for cascading dropdowns
  const parentCategories = categories.filter(c => c.parent_id === null)
  const subCategories = categories.filter(c => c.parent_id === selectedParentId)

  return {
    parentCategories,
    subCategories,
    selectedParentId,
    setSelectedParentId,
    isLoading,
    error
  }
}