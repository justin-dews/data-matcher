'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../providers'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ProductGrid from '@/components/catalog/ProductGrid'
import SearchFilters from '@/components/catalog/SearchFilters'
import BulkActionToolbar from '@/components/catalog/BulkActionToolbar'
import ProductFormModal from '@/components/catalog/ProductFormModal'
import ImportModal from '@/components/catalog/ImportModal'
import { PlusIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import type { Database } from '@/lib/supabase'

type Product = Database['public']['Tables']['products']['Row']

interface SearchFilters {
  query: string
  category: string
  manufacturer: string
}

export default function CatalogPage() {
  const { user, profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showProductForm, setShowProductForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    category: '',
    manufacturer: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })

  // Debounced search
  const [searchQuery, setSearchQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, query: searchQuery }))
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filtered products
  const filteredProducts = useMemo(() => {
    let filtered = products

    if (filters.query) {
      const query = filters.query.toLowerCase()
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.manufacturer && product.manufacturer.toLowerCase().includes(query)) ||
        (product.description && product.description.toLowerCase().includes(query))
      )
    }

    if (filters.category) {
      filtered = filtered.filter(product => product.category === filters.category)
    }

    if (filters.manufacturer) {
      filtered = filtered.filter(product => product.manufacturer === filters.manufacturer)
    }

    return filtered
  }, [products, filters])

  // Load products
  const loadProducts = async () => {
    if (!profile?.organization_id) return

    try {
      setLoading(true)
      const { data, error, count } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .range(
          (pagination.page - 1) * pagination.limit, 
          pagination.page * pagination.limit - 1
        )

      if (error) throw error

      setProducts(data || [])
      setPagination(prev => ({ ...prev, total: count || 0 }))
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [profile?.organization_id, pagination.page, pagination.limit])

  // Get unique categories and manufacturers for filters
  const categories = useMemo(() => {
    const cats = products.map(p => p.category).filter(Boolean) as string[]
    return Array.from(new Set(cats))
  }, [products])

  const manufacturers = useMemo(() => {
    const mfrs = products.map(p => p.manufacturer).filter(Boolean) as string[]
    return Array.from(new Set(mfrs))
  }, [products])

  const handleProductSave = async (productData: Partial<Product>) => {
    try {
      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            ...productData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingProduct.id)

        if (error) throw error
      } else {
        // Create new product
        const { error } = await supabase
          .from('products')
          .insert({
            ...productData,
            organization_id: profile?.organization_id!
          })

        if (error) throw error
      }

      await loadProducts()
      setShowProductForm(false)
      setEditingProduct(null)
    } catch (error) {
      console.error('Error saving product:', error)
    }
  }

  const handleProductDelete = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      await loadProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
    }
  }

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', selectedProducts)

      if (error) throw error

      await loadProducts()
      setSelectedProducts([])
    } catch (error) {
      console.error('Error bulk deleting products:', error)
    }
  }

  const handleProductEdit = (product: Product) => {
    setEditingProduct(product)
    setShowProductForm(true)
  }

  const handleImportComplete = () => {
    loadProducts()
    setShowImportModal(false)
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your product database, add new products, and import from files.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3 flex">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
            Import
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null)
              setShowProductForm(true)
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <SearchFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        categories={categories}
        manufacturers={manufacturers}
      />

      {/* Bulk Actions */}
      {selectedProducts.length > 0 && (
        <BulkActionToolbar
          selectedCount={selectedProducts.length}
          onBulkDelete={handleBulkDelete}
          onClearSelection={() => setSelectedProducts([])}
        />
      )}

      {/* Products Grid */}
      <ProductGrid
        products={filteredProducts}
        selectedProducts={selectedProducts}
        onProductSelect={setSelectedProducts}
        onProductEdit={handleProductEdit}
        onProductDelete={handleProductDelete}
        onProductUpdate={loadProducts}
        loading={loading}
      />

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page <= 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ 
                ...prev, 
                page: Math.min(Math.ceil(prev.total / prev.limit), prev.page + 1) 
              }))}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {(pagination.page - 1) * pagination.limit + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-none disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ 
                    ...prev, 
                    page: Math.min(Math.ceil(prev.total / prev.limit), prev.page + 1) 
                  }))}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-none disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showProductForm && (
        <ProductFormModal
          product={editingProduct}
          onSave={handleProductSave}
          onClose={() => {
            setShowProductForm(false)
            setEditingProduct(null)
          }}
        />
      )}

      {showImportModal && (
        <ImportModal
          onImportComplete={handleImportComplete}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  )
}