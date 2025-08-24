'use client'

import { useState } from 'react'
import { PencilIcon, TrashIcon, TagIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import InlineEditor from '@/components/catalog/InlineEditor'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']

interface ProductGridProps {
  products: Product[]
  selectedProducts: string[]
  onProductSelect: (selected: string[]) => void
  onProductEdit: (product: Product) => void
  onProductDelete: (productId: string) => void
  onProductUpdate?: () => void
  loading: boolean
}

export default function ProductGrid({
  products,
  selectedProducts,
  onProductSelect,
  onProductEdit,
  onProductDelete,
  onProductUpdate,
  loading
}: ProductGridProps) {
  const [editingField, setEditingField] = useState<{
    productId: string
    field: string
  } | null>(null)

  const handleInlineEdit = async (productId: string, field: string, value: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', productId)
      
      if (error) throw error
      
      // Trigger refresh if callback provided
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

  const formatPrice = (price: number | null) => {
    if (price === null) return 'No price'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by adding your first product or importing from a file.
        </p>
      </div>
    )
  }

  const allSelected = products.length > 0 && selectedProducts.length === products.length
  const someSelected = selectedProducts.length > 0 && selectedProducts.length < products.length

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        {/* Header with bulk select */}
        <div className="mb-6 flex items-center justify-between">
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
            <span className="ml-3 text-sm text-gray-700">
              {selectedProducts.length > 0 
                ? `${selectedProducts.length} selected`
                : `${products.length} products`
              }
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Updated {formatDate(Math.max(...products.map(p => new Date(p.updated_at).getTime())).toString())}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className={`relative rounded-lg border p-6 hover:shadow-md transition-shadow ${
                selectedProducts.includes(product.id)
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {/* Selection checkbox */}
              <div className="absolute top-4 left-4">
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(product.id)}
                  onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="absolute top-4 right-4 flex space-x-1">
                <button
                  onClick={() => onProductEdit(product)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Edit product"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onProductDelete(product.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete product"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Product Content */}
              <div className="mt-6">
                {/* SKU */}
                <div className="text-xs font-mono text-gray-500 mb-2">
                  SKU: {product.sku}
                </div>

                {/* Name - Inline editable */}
                <div className="mb-3">
                  <InlineEditor
                    value={product.name}
                    isEditing={editingField?.productId === product.id && editingField?.field === 'name'}
                    onEdit={() => setEditingField({ productId: product.id, field: 'name' })}
                    onSave={(value) => handleInlineEdit(product.id, 'name', value)}
                    onCancel={() => setEditingField(null)}
                    className="text-lg font-medium text-gray-900"
                    placeholder="Product name"
                  />
                </div>

                {/* Description - Inline editable */}
                <div className="mb-4">
                  <InlineEditor
                    value={product.description || 'No description'}
                    isEditing={editingField?.productId === product.id && editingField?.field === 'description'}
                    onEdit={() => setEditingField({ productId: product.id, field: 'description' })}
                    onSave={(value) => handleInlineEdit(product.id, 'description', value)}
                    onCancel={() => setEditingField(null)}
                    className="text-sm text-gray-600"
                    placeholder="Product description"
                    multiline
                  />
                </div>

                {/* Metadata */}
                <div className="space-y-2">
                  {/* Category */}
                  <div className="flex items-center text-sm">
                    <TagIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <InlineEditor
                      value={product.category || 'Uncategorized'}
                      isEditing={editingField?.productId === product.id && editingField?.field === 'category'}
                      onEdit={() => setEditingField({ productId: product.id, field: 'category' })}
                      onSave={(value) => handleInlineEdit(product.id, 'category', value)}
                      onCancel={() => setEditingField(null)}
                      className="text-gray-600"
                      placeholder="Category"
                    />
                  </div>

                  {/* Manufacturer */}
                  <div className="flex items-center text-sm">
                    <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <InlineEditor
                      value={product.manufacturer || 'Unknown'}
                      isEditing={editingField?.productId === product.id && editingField?.field === 'manufacturer'}
                      onEdit={() => setEditingField({ productId: product.id, field: 'manufacturer' })}
                      onSave={(value) => handleInlineEdit(product.id, 'manufacturer', value)}
                      onCancel={() => setEditingField(null)}
                      className="text-gray-600"
                      placeholder="Manufacturer"
                    />
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Price:</span>
                    <span className="font-medium text-gray-900">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                </div>

                {/* Tags/Metadata preview */}
                {product.metadata && Object.keys(product.metadata).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">Additional Properties</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(product.metadata).slice(0, 3).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {key}: {String(value).slice(0, 20)}
                        </span>
                      ))}
                      {Object.keys(product.metadata).length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{Object.keys(product.metadata).length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Created {formatDate(product.created_at)}</span>
                    {product.created_at !== product.updated_at && (
                      <span>Updated {formatDate(product.updated_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}