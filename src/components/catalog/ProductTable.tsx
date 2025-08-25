'use client'

import { useState } from 'react'
import { PencilIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import InlineEditor from '@/components/catalog/InlineEditor'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']

interface ProductTableProps {
  products: Product[]
  selectedProducts: string[]
  onProductSelect: (selected: string[]) => void
  onProductEdit: (product: Product) => void
  onProductDelete: (productId: string) => void
  onProductUpdate?: () => void
  loading: boolean
}

type SortField = 'sku' | 'name' | 'description' | 'category' | 'manufacturer' | 'price' | 'created_at'
type SortDirection = 'asc' | 'desc'

export default function ProductTable({
  products,
  selectedProducts,
  onProductSelect,
  onProductEdit,
  onProductDelete,
  onProductUpdate,
  loading
}: ProductTableProps) {
  const [editingField, setEditingField] = useState<{
    productId: string
    field: string
  } | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleInlineEdit = async (productId: string, field: string, value: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', productId)
      
      if (error) throw error
      
      if (onProductUpdate) {
        onProductUpdate()
      }
    } catch (error) {
      console.error('Error updating product:', error)
    } finally {
      setEditingField(null)
    }
  }

  const handleSelectProduct = (productId: string, selected: boolean) => {
    if (selected) {
      onProductSelect([...selectedProducts, productId])
    } else {
      onProductSelect(selectedProducts.filter(id => id !== productId))
    }
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      onProductSelect(products.map(p => p.id))
    } else {
      onProductSelect([])
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    let aValue: any = a[sortField]
    let bValue: any = b[sortField]

    // Handle null values
    if (aValue === null) aValue = ''
    if (bValue === null) bValue = ''

    // Convert to comparable values
    if (typeof aValue === 'string') aValue = aValue.toLowerCase()
    if (typeof bValue === 'string') bValue = bValue.toLowerCase()

    let comparison = 0
    if (aValue < bValue) comparison = -1
    if (aValue > bValue) comparison = 1

    return sortDirection === 'desc' ? -comparison : comparison
  })

  const formatPrice = (price: number | null) => {
    if (price === null) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUpIcon className="h-4 w-4 text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 text-gray-700" />
      : <ChevronDownIcon className="h-4 w-4 text-gray-700" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first product or importing from a file.
          </p>
        </div>
      </div>
    )
  }

  const allSelected = products.length > 0 && selectedProducts.length === products.length
  const someSelected = selectedProducts.length > 0 && selectedProducts.length < products.length

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Stats Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-3 text-sm font-medium text-gray-900">
              {selectedProducts.length > 0 
                ? `${selectedProducts.length} selected`
                : `${products.length} products`
              }
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Click column headers to sort
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                {/* Selection column */}
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('sku')}
              >
                <div className="flex items-center space-x-1">
                  <span>SKU</span>
                  <SortIcon field="sku" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Name</span>
                  <SortIcon field="name" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('description')}
              >
                <div className="flex items-center space-x-1">
                  <span>Description</span>
                  <SortIcon field="description" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center space-x-1">
                  <span>Category</span>
                  <SortIcon field="category" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('manufacturer')}
              >
                <div className="flex items-center space-x-1">
                  <span>Manufacturer</span>
                  <SortIcon field="manufacturer" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center space-x-1">
                  <span>Price</span>
                  <SortIcon field="price" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center space-x-1">
                  <span>Created</span>
                  <SortIcon field="created_at" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProducts.map((product, index) => (
              <tr 
                key={product.id} 
                className={`hover:bg-gray-50 ${
                  selectedProducts.includes(product.id) ? 'bg-blue-50' : ''
                }`}
              >
                {/* Selection */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>

                {/* SKU */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-mono text-gray-900 font-medium">
                    {product.sku}
                  </span>
                </td>

                {/* Name */}
                <td className="px-6 py-4">
                  <div className="max-w-xs">
                    <InlineEditor
                      value={product.name}
                      isEditing={editingField?.productId === product.id && editingField?.field === 'name'}
                      onEdit={() => setEditingField({ productId: product.id, field: 'name' })}
                      onSave={(value) => handleInlineEdit(product.id, 'name', value)}
                      onCancel={() => setEditingField(null)}
                      className="text-sm text-gray-900"
                      placeholder="Product name"
                    />
                  </div>
                </td>

                {/* Description */}
                <td className="px-6 py-4">
                  <div className="max-w-md">
                    <InlineEditor
                      value={product.description || 'No description'}
                      isEditing={editingField?.productId === product.id && editingField?.field === 'description'}
                      onEdit={() => setEditingField({ productId: product.id, field: 'description' })}
                      onSave={(value) => handleInlineEdit(product.id, 'description', value)}
                      onCancel={() => setEditingField(null)}
                      className="text-sm text-gray-600"
                      placeholder="Product description"
                    />
                  </div>
                </td>

                {/* Category */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <InlineEditor
                    value={product.category || 'Uncategorized'}
                    isEditing={editingField?.productId === product.id && editingField?.field === 'category'}
                    onEdit={() => setEditingField({ productId: product.id, field: 'category' })}
                    onSave={(value) => handleInlineEdit(product.id, 'category', value)}
                    onCancel={() => setEditingField(null)}
                    className="text-sm text-gray-600"
                    placeholder="Category"
                  />
                </td>

                {/* Manufacturer */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <InlineEditor
                    value={product.manufacturer || 'Unknown'}
                    isEditing={editingField?.productId === product.id && editingField?.field === 'manufacturer'}
                    onEdit={() => setEditingField({ productId: product.id, field: 'manufacturer' })}
                    onSave={(value) => handleInlineEdit(product.id, 'manufacturer', value)}
                    onCancel={() => setEditingField(null)}
                    className="text-sm text-gray-600"
                    placeholder="Manufacturer"
                  />
                </td>

                {/* Price */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatPrice(product.price)}
                </td>

                {/* Created Date */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(product.created_at)}
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => onProductEdit(product)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Edit product"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onProductDelete(product.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete product"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}