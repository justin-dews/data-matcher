'use client'

import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

interface SearchFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: {
    query: string
    category: string
    manufacturer: string
  }
  onFiltersChange: (filters: any) => void
  categories: string[]
  manufacturers: string[]
}

export default function SearchFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  categories,
  manufacturers
}: SearchFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearFilters = () => {
    onFiltersChange({
      query: '',
      category: '',
      manufacturer: ''
    })
    onSearchChange('')
  }

  const hasActiveFilters = filters.category || filters.manufacturer

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Search products by name, SKU, manufacturer, or description..."
        />
      </div>

      {/* Advanced Filters Toggle */}
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4 mr-1" />
          Advanced Filters
          {hasActiveFilters && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {[filters.category, filters.manufacturer].filter(Boolean).length}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Category Filter */}
            <div>
              <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="category-filter"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Manufacturer Filter */}
            <div>
              <label htmlFor="manufacturer-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer
              </label>
              <select
                id="manufacturer-filter"
                value={filters.manufacturer}
                onChange={(e) => handleFilterChange('manufacturer', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All Manufacturers</option>
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer} value={manufacturer}>
                    {manufacturer}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Quick Filters</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleFilterChange('category', 'Electronics')}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                Electronics
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('category', 'Hardware')}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                Hardware
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('category', 'Software')}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                Software
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="mt-4 text-sm text-gray-500">
        {hasActiveFilters ? (
          <span>Filtered results</span>
        ) : (
          <span>Showing all products</span>
        )}
      </div>
    </div>
  )
}