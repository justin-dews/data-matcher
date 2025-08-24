'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']

interface ProductFormModalProps {
  product: Product | null
  onSave: (productData: Partial<Product>) => void
  onClose: () => void
}

export default function ProductFormModal({
  product,
  onSave,
  onClose
}: ProductFormModalProps) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    manufacturer: '',
    price: '',
    metadata: {} as Record<string, any>
  })
  const [loading, setLoading] = useState(false)
  const [generatingEmbedding, setGeneratingEmbedding] = useState(false)
  const [metadataJson, setMetadataJson] = useState('')

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        category: product.category || '',
        manufacturer: product.manufacturer || '',
        price: product.price?.toString() || '',
        metadata: product.metadata || {}
      })
      setMetadataJson(JSON.stringify(product.metadata || {}, null, 2))
    } else {
      // Reset form for new product
      setFormData({
        sku: '',
        name: '',
        description: '',
        category: '',
        manufacturer: '',
        price: '',
        metadata: {}
      })
      setMetadataJson('{}')
    }
  }, [product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Parse metadata JSON
      let metadata = {}
      if (metadataJson.trim()) {
        try {
          metadata = JSON.parse(metadataJson)
        } catch (error) {
          alert('Invalid JSON in metadata field')
          setLoading(false)
          return
        }
      }

      const productData: Partial<Product> = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || null,
        category: formData.category || null,
        manufacturer: formData.manufacturer || null,
        price: formData.price ? parseFloat(formData.price) : null,
        metadata
      }

      // Generate embedding for new products
      if (!product) {
        await generateEmbedding(productData)
      }

      await onSave(productData)
    } catch (error) {
      console.error('Error saving product:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateEmbedding = async (productData: Partial<Product>) => {
    setGeneratingEmbedding(true)
    try {
      // Create embedding text from product data
      const embeddingText = [
        productData.name,
        productData.sku,
        productData.manufacturer,
        productData.category,
        productData.description
      ].filter(Boolean).join(' ')

      // Call the embed-text edge function
      const response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: embeddingText,
          productId: productData.id // Will be set after product creation
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate embedding')
      }
    } catch (error) {
      console.error('Error generating embedding:', error)
      // Don't fail the whole operation if embedding fails
    } finally {
      setGeneratingEmbedding(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const isValid = formData.sku && formData.name

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium leading-6 text-gray-900">
                  {product ? 'Edit Product' : 'Add New Product'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                {/* SKU and Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                      SKU *
                    </label>
                    <input
                      type="text"
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="e.g., PROD-001"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="e.g., Wireless Headphones"
                      required
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Product description..."
                  />
                </div>

                {/* Category, Manufacturer, Price */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <input
                      type="text"
                      id="category"
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="e.g., Electronics"
                    />
                  </div>
                  <div>
                    <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700">
                      Manufacturer
                    </label>
                    <input
                      type="text"
                      id="manufacturer"
                      value={formData.manufacturer}
                      onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="e.g., Sony"
                    />
                  </div>
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                      Price ($)
                    </label>
                    <input
                      type="number"
                      id="price"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Advanced: Metadata JSON */}
                <div>
                  <label htmlFor="metadata" className="block text-sm font-medium text-gray-700">
                    Additional Metadata (JSON)
                  </label>
                  <textarea
                    id="metadata"
                    value={metadataJson}
                    onChange={(e) => setMetadataJson(e.target.value)}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono text-xs"
                    placeholder='{"key": "value", "tags": ["tag1", "tag2"]}'
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter valid JSON for additional product properties
                  </p>
                </div>

                {/* AI Embedding Notice */}
                {!product && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex">
                      <SparklesIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-900">
                          AI-Powered Matching
                        </h4>
                        <p className="text-sm text-blue-700">
                          We'll automatically generate embeddings for this product to enable intelligent matching with uploaded documents.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={!isValid || loading}
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
              >
                {loading && <LoadingSpinner size="sm" className="mr-2" />}
                {generatingEmbedding ? 'Generating AI embedding...' : loading ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}