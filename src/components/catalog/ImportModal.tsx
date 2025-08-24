'use client'

import { useState, useCallback } from 'react'
import { XMarkIcon, DocumentArrowUpIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../app/providers'

interface ImportModalProps {
  onImportComplete: () => void
  onClose: () => void
}

interface ImportedProduct {
  sku: string
  name: string
  description?: string
  category?: string
  manufacturer?: string
  price?: number
  metadata?: Record<string, any>
  status: 'pending' | 'success' | 'error'
  error?: string
}

export default function ImportModal({
  onImportComplete,
  onClose
}: ImportModalProps) {
  const { profile } = useAuth()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [parsedProducts, setParsedProducts] = useState<ImportedProduct[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [importResults, setImportResults] = useState({ success: 0, errors: 0 })

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFile = (selectedFile: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!validTypes.includes(selectedFile.type)) {
      alert('Please select a CSV or Excel file')
      return
    }

    setFile(selectedFile)
    parseFile(selectedFile)
  }

  const parseFile = async (file: File) => {
    setParsing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'products') // Indicate this is product data

      const response = await fetch('/api/parse-csv', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to parse file')
      }

      const result = await response.json()
      
      // Transform parsed data into ImportedProduct format
      const products: ImportedProduct[] = result.data.map((row: any, index: number) => {
        try {
          return {
            sku: row.sku || row.SKU || `IMPORT-${index + 1}`,
            name: row.name || row.Name || row.product_name || row['Product Name'] || 'Unnamed Product',
            description: row.description || row.Description || '',
            category: row.category || row.Category || '',
            manufacturer: row.manufacturer || row.Manufacturer || row.brand || row.Brand || '',
            price: parseFloat(row.price || row.Price || '0') || undefined,
            metadata: {
              import_source: file.name,
              import_date: new Date().toISOString(),
              raw_data: row
            },
            status: 'pending' as const
          }
        } catch (error) {
          return {
            sku: `ERROR-${index + 1}`,
            name: 'Parse Error',
            status: 'error' as const,
            error: 'Failed to parse row data'
          }
        }
      })

      setParsedProducts(products)
      setStep('preview')
    } catch (error) {
      console.error('Error parsing file:', error)
      alert('Error parsing file. Please check the format and try again.')
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!profile?.organization_id) return

    setImporting(true)
    setStep('importing')

    let successCount = 0
    let errorCount = 0

    for (const product of parsedProducts) {
      if (product.status === 'error') {
        errorCount++
        continue
      }

      try {
        // Insert product
        const { data: insertedProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            organization_id: profile.organization_id,
            sku: product.sku,
            name: product.name,
            description: product.description || null,
            category: product.category || null,
            manufacturer: product.manufacturer || null,
            price: product.price || null,
            metadata: product.metadata || {}
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Generate embedding for the product
        if (insertedProduct) {
          await generateEmbedding(insertedProduct)
        }

        product.status = 'success'
        successCount++
      } catch (error) {
        console.error('Error importing product:', error)
        product.status = 'error'
        product.error = error instanceof Error ? error.message : 'Unknown error'
        errorCount++
      }
    }

    setImportResults({ success: successCount, errors: errorCount })
    setParsedProducts([...parsedProducts]) // Trigger re-render
    setStep('complete')
    setImporting(false)
  }

  const generateEmbedding = async (product: any) => {
    try {
      const embeddingText = [
        product.name,
        product.sku,
        product.manufacturer,
        product.category,
        product.description
      ].filter(Boolean).join(' ')

      await fetch('/api/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: embeddingText,
          productId: product.id
        })
      })
    } catch (error) {
      console.error('Error generating embedding:', error)
      // Don't fail the import if embedding fails
    }
  }

  const handleComplete = () => {
    onImportComplete()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Import Products
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="mb-8">
              <nav aria-label="Progress">
                <ol className="flex items-center">
                  {[
                    { id: 'upload', name: 'Upload File', status: step === 'upload' ? 'current' : 'complete' },
                    { id: 'preview', name: 'Preview Data', status: step === 'preview' ? 'current' : step === 'upload' ? 'upcoming' : 'complete' },
                    { id: 'importing', name: 'Import', status: step === 'importing' ? 'current' : ['upload', 'preview'].includes(step) ? 'upcoming' : 'complete' },
                    { id: 'complete', name: 'Complete', status: step === 'complete' ? 'current' : 'upcoming' }
                  ].map((stepItem, stepIdx) => (
                    <li key={stepItem.id} className={`relative ${stepIdx !== 3 ? 'pr-8 sm:pr-20' : ''}`}>
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="h-0.5 w-full bg-gray-200" />
                      </div>
                      <div className={`relative w-8 h-8 flex items-center justify-center rounded-full ${
                        stepItem.status === 'complete' 
                          ? 'bg-blue-600' 
                          : stepItem.status === 'current' 
                            ? 'border-2 border-blue-600 bg-white' 
                            : 'border-2 border-gray-300 bg-white'
                      }`}>
                        {stepItem.status === 'complete' && (
                          <CheckIcon className="w-5 h-5 text-white" />
                        )}
                        {stepItem.status === 'current' && (
                          <span className="h-2.5 w-2.5 bg-blue-600 rounded-full" />
                        )}
                        {stepItem.status === 'upcoming' && (
                          <span className="h-2.5 w-2.5 bg-gray-300 rounded-full" />
                        )}
                      </div>
                      <span className="ml-4 text-xs font-medium text-gray-500">{stepItem.name}</span>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>

            {/* Step Content */}
            {step === 'upload' && (
              <div>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 ${
                    dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Upload a CSV or Excel file
                        </span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleFileInput}
                        />
                        <span className="mt-2 block text-sm text-gray-500">
                          or drag and drop
                        </span>
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      CSV, XLS, XLSX up to 10MB
                    </p>
                  </div>

                  {file && (
                    <div className="mt-4 flex items-center justify-center">
                      <div className="flex items-center space-x-2">
                        <CheckIcon className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-gray-900">{file.name}</span>
                        <span className="text-sm text-gray-500">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    </div>
                  )}

                  {parsing && (
                    <div className="mt-4 flex items-center justify-center">
                      <LoadingSpinner size="sm" className="mr-2" />
                      <span className="text-sm text-gray-600">Parsing file...</span>
                    </div>
                  )}
                </div>

                {/* Format Guidelines */}
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Expected Format</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Your file should contain columns with product information:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><strong>Required:</strong> SKU, Name (or Product Name)</li>
                      <li><strong>Optional:</strong> Description, Category, Manufacturer, Price</li>
                      <li>Additional columns will be stored as metadata</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">
                    Preview ({parsedProducts.length} products)
                  </h4>
                  <div className="text-sm text-gray-500">
                    Review the data before importing
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Manufacturer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {parsedProducts.map((product, index) => (
                        <tr key={index} className={product.status === 'error' ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {product.sku}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {product.category || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {product.manufacturer || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {product.price ? `$${product.price.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {product.status === 'error' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                Error
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <SparklesIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-900">
                        AI Embeddings Will Be Generated
                      </h4>
                      <p className="text-sm text-blue-700">
                        We'll automatically generate embeddings for each product to enable intelligent matching with uploaded documents.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="text-center py-8">
                <LoadingSpinner size="lg" className="mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Importing Products...
                </h4>
                <p className="text-sm text-gray-600">
                  This may take a few moments as we generate AI embeddings for each product.
                </p>
              </div>
            )}

            {step === 'complete' && (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <CheckIcon className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mt-4 mb-2">
                  Import Complete!
                </h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>{importResults.success} products imported successfully</p>
                  {importResults.errors > 0 && (
                    <p className="text-red-600">{importResults.errors} products failed to import</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            {step === 'upload' && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            )}

            {step === 'preview' && (
              <>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={parsedProducts.length === 0}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Import {parsedProducts.filter(p => p.status !== 'error').length} Products
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('upload')
                    setFile(null)
                    setParsedProducts([])
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Back
                </button>
              </>
            )}

            {step === 'complete' && (
              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto sm:text-sm"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}