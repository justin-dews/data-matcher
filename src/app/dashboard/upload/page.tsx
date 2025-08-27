'use client'

import { useState } from 'react'
import { useAuth } from '@/app/providers'
import { supabase } from '@/lib/supabase'
import FileDropzone from '@/components/upload/FileDropzone'
import ParsingProgress from '@/components/upload/ParsingProgress'
import ExtractedDataTable from '@/components/upload/ExtractedDataTable'
import { DocumentPlusIcon } from '@heroicons/react/24/outline'

interface LineItem {
  id: string
  item_number?: string
  part_number?: string
  description?: string
  raw_text: string
  normalized_text: string
  quantity: number | null
  unit_price: number | null
  total?: number | null
  position: number
}

interface DocumentData {
  id: string
  filename: string
  lineItems: LineItem[]
}

export default function UploadPage() {
  const { user, profile, loading: authLoading } = useAuth()
  console.log('🔍 Current user state:', { user: !!user, userId: user?.id, email: user?.email, profile: !!profile })
  
  const [file, setFile] = useState<File | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [parsing, setParsing] = useState(false)
  const [documentData, setDocumentData] = useState<DocumentData | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (selectedFile: File | null) => {
    console.log('📁 File selected:', selectedFile?.name, selectedFile?.size)
    setFile(selectedFile)
    setDocumentData(null) // Clear previous results
    setError(null)
  }

  const handleParse = async () => {
    console.log('🚀 handleParse called', { file: !!file, user: !!user, profile: !!profile, userId: user?.id })
    
    if (!file || !user || !profile || authLoading) {
      console.error('❌ Missing required data:', { file: !!file, user: !!user, profile: !!profile, authLoading })
      setError('Missing file, user authentication, or profile data')
      return
    }

    console.log('✅ Starting upload process...')
    setParsing(true)
    setProgress(0)
    setError(null)

    try {
      // Upload file via API route to bypass RLS issues
      console.log('📁 Uploading to Supabase Storage via API route...')
      setProgress(20)
      const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`
      console.log('📝 Generated fileName:', fileName)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', fileName)
      
      const uploadResponse = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData
      })
      
      const uploadResult = await uploadResponse.json()
      
      if (!uploadResponse.ok || !uploadResult.success) {
        console.error('❌ Upload failed:', uploadResult.error)
        throw new Error(`Upload failed: ${uploadResult.error}`)
      }

      console.log('✅ File uploaded successfully:', uploadResult.data)
      setProgress(40)

      // Create document record via API route to bypass RLS
      console.log('💾 Creating document record...')
      const createDocResponse = await fetch('/api/create-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          filename: file.name,
          file_path: fileName,
        })
      })
      
      const createDocResult = await createDocResponse.json()
      
      if (!createDocResponse.ok || !createDocResult.success) {
        console.error('❌ Document record creation failed:', createDocResult.error)
        throw new Error(`Database error: ${createDocResult.error}`)
      }
      
      const documentRecord = createDocResult.data

      console.log('✅ Document record created:', documentRecord)
      setProgress(60)

      // Call parse-pdf edge function
      console.log('🔥 Calling parse-pdf edge function with:', { storagePath: fileName, schema: 'invoice' })
      const { data: parseData, error: parseError } = await supabase.functions
        .invoke('parse-pdf', {
          body: {
            storagePath: fileName,
            schema: 'invoice'
          }
        })

      if (parseError) {
        console.error('❌ Edge function error details:', {
          message: parseError.message,
          status: parseError.status,
          statusText: parseError.statusText,
          context: parseError.context
        })
        throw new Error(`Parse error: ${parseError.message || 'Edge function authentication failed - check API keys'}`)
      }

      console.log('✅ Parse completed successfully:', parseData)
      setProgress(80)

      // Insert line items via API route to bypass RLS
      console.log('📝 Inserting line items...')
      const lineItemsToInsert = parseData.lineItems.map((item: LineItem, index: number) => ({
        document_id: documentRecord.id,
        organization_id: profile.organization_id,
        line_number: item.position || index + 1,
        raw_text: item.raw_text,
        parsed_data: item,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total,
        company_name: companyName.trim() || null, // Add company name
      }))

      const insertLineItemsResponse = await fetch('/api/insert-line-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems: lineItemsToInsert })
      })
      
      const insertLineItemsResult = await insertLineItemsResponse.json()
      
      if (!insertLineItemsResponse.ok || !insertLineItemsResult.success) {
        throw new Error(`Line items error: ${insertLineItemsResult.error}`)
      }

      console.log('✅ Line items inserted successfully')

      // AUTO-GENERATE MATCHES: This is the root cause fix!
      // Instead of requiring users to manually click "Generate Matches",
      // we automatically create matches for all uploaded line items
      console.log('🎯 Auto-generating matches for uploaded line items...')
      setProgress(85) // Show progress during match generation
      
      try {
        const matchResponse = await fetch('/api/generate-matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: profile.organization_id,
            userId: user.id
          })
        })

        if (matchResponse.ok) {
          const matchResult = await matchResponse.json()
          if (matchResult.success) {
            console.log(`✅ Auto-generated ${matchResult.generatedCount} matches out of ${matchResult.totalProcessed} line items`)
            
            // Log specific training matches found
            if (matchResult.results) {
              const trainingMatches = matchResult.results.filter((r: any) => r.matchedVia === 'training_exact')
              if (trainingMatches.length > 0) {
                console.log('🎯 Found exact training matches:')
                trainingMatches.forEach((match: any) => {
                  console.log(`  "${match.lineItemText}" → ${match.matchedProduct} (score: ${match.score})`)
                })
              }
            }
          } else {
            console.warn('⚠️ Match generation failed:', matchResult.error)
          }
        } else {
          console.warn('⚠️ Match generation request failed:', matchResponse.status)
        }
      } catch (matchError) {
        console.error('⚠️ Error during automatic match generation:', matchError)
        // Don't fail the upload if match generation fails
      }

      setProgress(100)
      
      // Store document data with full parsed line items for display
      setDocumentData({
        id: documentRecord.id,
        filename: file.name,
        lineItems: parseData.lineItems // Use the full parsed data with all fields
      })

      // Update document status to include match generation
      console.log('📊 Updating document status...')
      await supabase
        .from('documents')
        .update({ 
          status: 'processed', // Changed from 'parsed' to 'processed' since we now include matching
          parse_result: { lineItems: parseData.lineItems, metadata: parseData.metadata }
        })
        .eq('id', documentRecord.id)

      // Log activity
      console.log('📋 Logging activity...')
      await supabase
        .from('activity_log')
        .insert({
          organization_id: profile.organization_id,
          user_id: user.id,
          action: 'document_processed', // Changed from 'parse_complete' to reflect full processing
          resource_type: 'document',
          resource_id: documentRecord.id,
          metadata: {
            filename: file.name,
            line_count: parseData.lineItems.length,
            auto_matched: true // Flag to indicate automatic matching was performed
          }
        })

      console.log('🎉 Upload, parsing, and automatic matching completed successfully!')

    } catch (error) {
      console.error('Parse error:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred.')
    } finally {
      setParsing(false)
      setProgress(0)
    }
  }

  const handleEditLineItem = (id: string, newText: string) => {
    if (!documentData) return
    
    setDocumentData(prev => ({
      ...prev!,
      lineItems: prev!.lineItems.map(item => 
        item.id === id 
          ? { ...item, raw_text: newText, normalized_text: newText.toLowerCase().trim() }
          : item
      )
    }))
  }

  const handleReset = () => {
    setFile(null)
    setCompanyName('')
    setDocumentData(null)
    setError(null)
    setProgress(0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <DocumentPlusIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload & Parse</h1>
            <p className="text-gray-600">
              Upload PDF documents and extract line item data automatically
            </p>
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      {!documentData && (
        <div className="space-y-6">
          {/* File Upload */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Select Document
            </h2>
            <FileDropzone
              onFileSelect={handleFileSelect}
              selectedFile={file}
            />
          </div>

          {/* Company Name Field */}
          {file && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Company Information
              </h2>
              <div className="space-y-2">
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                  Company Name <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., ACME Supply Co, ABC Industrial"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-gray-600">
                  This helps identify the competitor company for better matching accuracy over time.
                </p>
              </div>
            </div>
          )}

          {/* Upload Button */}
          {file && (
            <button
              onClick={() => {
                console.log('🔴 BUTTON CLICKED!')
                handleParse()
              }}
              disabled={parsing}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {parsing ? 'Parsing...' : 'Upload & Parse Document'}
            </button>
          )}

          {/* Progress */}
          {parsing && (
            <ParsingProgress
              status={parsing ? 'parsing' : 'idle'}
              progress={progress}
              filename={file?.name || ''}
            />
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-800">
                    Upload Failed
                  </h3>
                  <p className="text-red-600 mt-1">
                    {error}
                  </p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="bg-red-100 text-red-800 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extracted Data */}
      {documentData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Extracted Line Items ({documentData.lineItems.length})
            </h2>
            <button
              onClick={handleReset}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Upload Another Document
            </button>
          </div>
          
          {documentData.lineItems.length > 0 ? (
            <ExtractedDataTable
              lineItems={documentData.lineItems}
              onLineItemUpdate={handleEditLineItem}
            />
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-yellow-800">
                No Line Items Found
              </h3>
              <p className="text-yellow-600 mt-1">
                The PDF was processed successfully, but no tabular data could be extracted. This might be a non-invoice document or have a format that's difficult to parse.
              </p>
              <button
                onClick={handleReset}
                className="mt-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                Try Another Document
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}