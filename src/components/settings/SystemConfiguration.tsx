'use client'

import { useState } from 'react'
import { CogIcon, PlusIcon, TrashIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SettingsSection from './SettingsSection'

interface SystemConfigurationProps {
  settings: {
    parsing_presets: Record<string, any>
    export_settings: Record<string, any>
    webhook_urls: string[]
  }
  onSave: (key: string, value: any) => Promise<void>
  onSaveMultiple: (settings: Record<string, any>) => Promise<void>
  loading: boolean
}

export default function SystemConfiguration({
  settings,
  onSave,
  onSaveMultiple,
  loading
}: SystemConfigurationProps) {
  const [formData, setFormData] = useState({
    parsing_presets: {
      invoice: {
        name: 'Invoice Processing',
        description: 'Standard invoice line item extraction',
        strict_mode: false,
        extract_line_items: true,
        extract_metadata: true,
        require_quantities: false,
        require_prices: false,
        ...settings.parsing_presets?.invoice
      },
      catalog: {
        name: 'Product Catalog',
        description: 'Structured product information extraction',
        strict_mode: true,
        extract_line_items: false,
        extract_metadata: true,
        require_quantities: false,
        require_prices: true,
        ...settings.parsing_presets?.catalog
      },
      quote: {
        name: 'Quote Processing', 
        description: 'Quote and proposal line item extraction',
        strict_mode: false,
        extract_line_items: true,
        extract_metadata: false,
        require_quantities: true,
        require_prices: true,
        ...settings.parsing_presets?.quote
      }
    },
    export_settings: {
      default_format: 'csv',
      include_confidence_scores: true,
      include_metadata: false,
      include_timestamps: true,
      max_export_rows: 10000,
      ...settings.export_settings
    },
    webhook_urls: [...(settings.webhook_urls || [])]
  })

  const [newWebhookUrl, setNewWebhookUrl] = useState('')

  const handleInputChange = (section: string, field: string, value: any) => {
    if (section.includes('.')) {
      const [parent, child] = section.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as Record<string, any>),
          [child]: {
            ...(prev[parent as keyof typeof prev] as any)?.[child],
            [field]: value
          }
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof typeof prev] as Record<string, any>),
          [field]: value
        }
      }))
    }
  }

  const addWebhook = () => {
    if (newWebhookUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        webhook_urls: [...prev.webhook_urls, newWebhookUrl.trim()]
      }))
      setNewWebhookUrl('')
    }
  }

  const removeWebhook = (index: number) => {
    setFormData(prev => ({
      ...prev,
      webhook_urls: prev.webhook_urls.filter((_, i) => i !== index)
    }))
  }

  const handleSaveAll = async () => {
    await onSaveMultiple(formData)
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(formData)

  const exportFormats = [
    { value: 'csv', label: 'CSV (Comma-separated)' },
    { value: 'xlsx', label: 'Excel (.xlsx)' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' }
  ]

  return (
    <SettingsSection
      title="System Configuration"
      description="Advanced settings for parsing, exports, and integrations"
    >
      {/* Parsing Presets */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <DocumentTextIcon className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Parsing Presets</h4>
        </div>
        
        <div className="space-y-6">
          {Object.entries(formData.parsing_presets).map(([presetKey, preset]) => (
            <div key={presetKey} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-medium text-gray-900">{preset.name}</h5>
                  <p className="text-xs text-gray-500">{preset.description}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {presetKey}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700">Strict Mode</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preset.strict_mode}
                      onChange={(e) => handleInputChange(`parsing_presets.${presetKey}`, 'strict_mode', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700">Extract Line Items</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preset.extract_line_items}
                      onChange={(e) => handleInputChange(`parsing_presets.${presetKey}`, 'extract_line_items', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700">Extract Metadata</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preset.extract_metadata}
                      onChange={(e) => handleInputChange(`parsing_presets.${presetKey}`, 'extract_metadata', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700">Require Quantities</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preset.require_quantities}
                      onChange={(e) => handleInputChange(`parsing_presets.${presetKey}`, 'require_quantities', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <CogIcon className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Export Settings</h4>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Default Export Format
              </label>
              <select
                value={formData.export_settings.default_format}
                onChange={(e) => handleInputChange('export_settings', 'default_format', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                {exportFormats.map(format => (
                  <option key={format.value} value={format.value}>{format.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Maximum Export Rows
              </label>
              <input
                type="number"
                min="100"
                max="100000"
                step="100"
                value={formData.export_settings.max_export_rows}
                onChange={(e) => handleInputChange('export_settings', 'max_export_rows', Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Include Confidence Scores
                </label>
                <p className="text-xs text-gray-500">
                  Add matching confidence scores to exported data
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.export_settings.include_confidence_scores}
                  onChange={(e) => handleInputChange('export_settings', 'include_confidence_scores', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Include Metadata
                </label>
                <p className="text-xs text-gray-500">
                  Export additional product and matching metadata
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.export_settings.include_metadata}
                  onChange={(e) => handleInputChange('export_settings', 'include_metadata', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700">
                  Include Timestamps
                </label>
                <p className="text-xs text-gray-500">
                  Add creation and modification dates to exports
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.export_settings.include_timestamps}
                  onChange={(e) => handleInputChange('export_settings', 'include_timestamps', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook URLs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900">Webhook URLs</h4>
          <p className="text-xs text-gray-500">Receive real-time notifications</p>
        </div>
        
        <div className="space-y-3">
          {formData.webhook_urls.map((url, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  const newUrls = [...formData.webhook_urls]
                  newUrls[index] = e.target.value
                  setFormData(prev => ({
                    ...prev,
                    webhook_urls: newUrls
                  }))
                }}
                className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="https://your-api.com/webhook"
              />
              <button
                type="button"
                onClick={() => removeWebhook(index)}
                className="inline-flex items-center p-2 border border-transparent text-red-600 hover:text-red-900"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          <div className="flex items-center space-x-2">
            <input
              type="url"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Add new webhook URL..."
            />
            <button
              type="button"
              onClick={addWebhook}
              disabled={!newWebhookUrl.trim()}
              className="inline-flex items-center p-2 border border-transparent text-blue-600 hover:text-blue-900 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <p className="text-xs text-gray-600">
            <strong>Webhook Events:</strong> document.processed, match.found, match.approved, match.rejected, export.completed
          </p>
        </div>
      </div>

      {/* Advanced Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <CogIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Advanced Configuration
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                These settings affect core system functionality. Changes may impact parsing accuracy and performance. Test thoroughly in a development environment before applying to production.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Changes */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading && <LoadingSpinner size="sm" className="mr-2" />}
            Save System Configuration
          </button>
        </div>
      )}
    </SettingsSection>
  )
}