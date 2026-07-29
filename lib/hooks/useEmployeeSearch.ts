import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type EmployeePreview = {
  id: string
  employee_no: string
  full_name: string
  department: string | null
}

export function useEmployeeSearch(delayMs: number = 500) {
  const [employeeNo, setEmployeeNo] = useState('')
  const [employee, setEmployee] = useState<EmployeePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  
  // Data Layer initialization
  const supabase = createClient()

  useEffect(() => {
    const fetchEmployee = async () => {
      // Business Logic: Ignore invalid/short inputs
      if (employeeNo.trim().length < 3) {
        setEmployee(null)
        setError(null)
        return
      }

      setIsSearching(true)
      setError(null)

      // Data Layer: External communication
      const { data, error: fetchError } = await supabase
        .from('employees')
        .select('id, employee_no, full_name, department')
        .eq('employee_no', employeeNo.trim())
        .eq('is_active', true)
        .single()

      if (fetchError) {
        setEmployee(null)
        setError('Employee not found or inactive.')
      } else if (data) {
        setEmployee(data)
      }

      setIsSearching(false)
    }

    // Business Logic: Debounce network requests
    const debounceTimer = setTimeout(fetchEmployee, delayMs)
    return () => clearTimeout(debounceTimer)
  }, [employeeNo, delayMs, supabase])

  return {
    employeeNo,
    setEmployeeNo,
    employee,
    error,
    isSearching,
  }
}