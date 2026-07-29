'use client'

import { useTicketCategories } from '@/lib/hooks/useTicketCategories'

interface CategorySelectProps {
  onCategorySelected: (categoryId: string) => void
}

export function CategorySelector({ onCategorySelected }: CategorySelectProps) {
  const { 
    parentCategories, 
    subCategories, 
    selectedParentId, 
    setSelectedParentId, 
    isLoading, 
    error 
  } = useTicketCategories()

  if (error) return <div className="text-red-500 text-sm">{error}</div>
  if (isLoading) return <div className="text-gray-500 text-sm animate-pulse">Loading categories...</div>

  return (
    <div className="flex flex-col space-y-4 w-full max-w-md">
      <div className="flex flex-col space-y-2">
        <label htmlFor="parentCategory" className="text-sm font-medium text-gray-700">
          Category
        </label>
        <select
          id="parentCategory"
          className="border border-gray-300 rounded-md p-2 bg-white"
          value={selectedParentId || ''}
          onChange={(e) => {
            const newParentId = e.target.value
            setSelectedParentId(newParentId)
            // Immediately register the parent category as the selected category
            onCategorySelected(newParentId) 
          }}
        >
          <option value="" disabled>Select a primary category...</option>
          {parentCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.code})
            </option>
          ))}
        </select>
      </div>

      {selectedParentId && subCategories.length > 0 && (
        <div className="flex flex-col space-y-2 animate-in fade-in slide-in-from-top-2">
          <label htmlFor="subCategory" className="text-sm font-medium text-gray-700">
            Subcategory (Optional)
          </label>
          <select
            id="subCategory"
            className="border border-gray-300 rounded-md p-2 bg-white"
            defaultValue=""
            onChange={(e) => {
              const selectedValue = e.target.value
              // If the user reverts to the default placeholder, fallback to the parent ID
              onCategorySelected(selectedValue || selectedParentId)
            }}
          >
            <option value="">-- General / No Subcategory --</option>
            {subCategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name} ({sub.code})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}