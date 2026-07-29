'use client'

import { useEffect } from 'react'
import { useEmployeeSearch } from '@/lib/hooks/useEmployeeSearch'

interface EmployeeLookupProps {
  onEmployeeFound: (employeeId: string | null) => void
}

export function EmployeeLookup({ onEmployeeFound }: EmployeeLookupProps) {

  const { employeeNo, setEmployeeNo, employee, error, isSearching } = useEmployeeSearch()


  useEffect(() => {
    onEmployeeFound(employee?.id || null)
  }, [employee, onEmployeeFound])


  return (
    <div className="flex flex-col space-y-2 w-full max-w-md">
      <label htmlFor="employeeNo" className="text-sm font-medium text-gray-700">
        Requester Employee ID
      </label>
      <input
        id="employeeNo"
        name='employee_no'
        type="text"
        className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
        placeholder="Scan or type ID..."
        value={employeeNo}
        onChange={(e) => setEmployeeNo(e.target.value)}
        aria-invalid={!!error}
      />
      
      {isSearching && <p className="text-sm text-gray-500 animate-pulse">Searching directory...</p>}
      {error && !isSearching && <p className="text-sm text-red-600">{error}</p>}
      
      {employee && !isSearching && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md flex flex-col">
          <span className="text-sm font-semibold text-green-900">{employee.full_name}</span>
          <span className="text-xs text-green-700">
            {employee.department ? employee.department : 'No Department Assigned'}
          </span>
        </div>
      )}
    </div>
  )
}