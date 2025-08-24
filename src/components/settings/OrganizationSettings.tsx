'use client'

import { useState } from 'react'
import { BuildingOfficeIcon, CogIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SettingsSection from './SettingsSection'
import type { Database } from '@/lib/supabase'

type OrganizationRow = Database['public']['Tables']['organizations']['Row']

interface OrganizationSettingsProps {
  organization: OrganizationRow
  settings: {
    organization_name: string
    organization_settings: Record<string, any>
  }
  onSave: (key: string, value: any) => Promise<void>
  onSaveMultiple: (settings: Record<string, any>) => Promise<void>
  loading: boolean
}

export default function OrganizationSettings({
  organization,
  settings,
  onSave,
  onSaveMultiple,
  loading
}: OrganizationSettingsProps) {
  const [formData, setFormData] = useState({
    organization_name: settings.organization_name,
    timezone: settings.organization_settings?.timezone || 'America/New_York',
    dateFormat: settings.organization_settings?.dateFormat || 'MM/dd/yyyy',
    numberFormat: settings.organization_settings?.numberFormat || 'en-US',
    defaultCurrency: settings.organization_settings?.defaultCurrency || 'USD',
    workflowSettings: {
      requireReviewForAutoMatches: settings.organization_settings?.workflowSettings?.requireReviewForAutoMatches ?? false,
      enableBulkOperations: settings.organization_settings?.workflowSettings?.enableBulkOperations ?? true,
      allowGuestUploads: settings.organization_settings?.workflowSettings?.allowGuestUploads ?? false,
      maxFileSize: settings.organization_settings?.workflowSettings?.maxFileSize || 50,
    },
    retentionSettings: {
      keepDocuments: settings.organization_settings?.retentionSettings?.keepDocuments || 365,
      keepActivityLogs: settings.organization_settings?.retentionSettings?.keepActivityLogs || 90,
      autoDeleteRejected: settings.organization_settings?.retentionSettings?.autoDeleteRejected ?? true,
    }
  })

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev] as Record<string, any>,
          [child]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleSaveAll = async () => {
    const { organization_name, ...orgSettings } = formData
    
    await onSaveMultiple({
      organization_name,
      organization_settings: orgSettings
    })
  }

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Europe/London',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ]

  const currencies = [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'
  ]

  const hasChanges = JSON.stringify({
    organization_name: settings.organization_name,
    ...settings.organization_settings
  }) !== JSON.stringify(formData)

  return (
    <SettingsSection
      title="Organization Configuration"
      description="Manage your organization settings and workspace preferences"
    >
      {/* Organization Info */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Organization Details</h4>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Organization Name
            </label>
            <input
              type="text"
              value={formData.organization_name}
              onChange={(e) => handleInputChange('organization_name', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Organization Slug
            </label>
            <input
              type="text"
              value={organization.slug}
              disabled
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Contact support to change your organization slug
            </p>
          </div>
        </div>
      </div>

      {/* Regional Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <CogIcon className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-medium text-gray-900">Regional Settings</h4>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => handleInputChange('timezone', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Default Currency
            </label>
            <select
              value={formData.defaultCurrency}
              onChange={(e) => handleInputChange('defaultCurrency', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {currencies.map(currency => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Date Format
            </label>
            <select
              value={formData.dateFormat}
              onChange={(e) => handleInputChange('dateFormat', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="MM/dd/yyyy">MM/dd/yyyy (US)</option>
              <option value="dd/MM/yyyy">dd/MM/yyyy (EU)</option>
              <option value="yyyy-MM-dd">yyyy-MM-dd (ISO)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Number Format
            </label>
            <select
              value={formData.numberFormat}
              onChange={(e) => handleInputChange('numberFormat', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="en-US">1,234.56 (US)</option>
              <option value="en-GB">1,234.56 (UK)</option>
              <option value="de-DE">1.234,56 (DE)</option>
              <option value="fr-FR">1 234,56 (FR)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Workflow Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900">Workflow Settings</h4>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Require Review for Auto-Matches
              </label>
              <p className="text-xs text-gray-500">
                Even high-confidence automatic matches will require manual review
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.workflowSettings.requireReviewForAutoMatches}
                onChange={(e) => handleInputChange('workflowSettings.requireReviewForAutoMatches', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Enable Bulk Operations
              </label>
              <p className="text-xs text-gray-500">
                Allow users to approve/reject multiple matches at once
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.workflowSettings.enableBulkOperations}
                onChange={(e) => handleInputChange('workflowSettings.enableBulkOperations', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Allow Guest Uploads
              </label>
              <p className="text-xs text-gray-500">
                External users can upload documents for processing
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.workflowSettings.allowGuestUploads}
                onChange={(e) => handleInputChange('workflowSettings.allowGuestUploads', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Maximum File Size (MB)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.workflowSettings.maxFileSize}
              onChange={(e) => handleInputChange('workflowSettings.maxFileSize', Number(e.target.value))}
              className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Data Retention */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-900">Data Retention</h4>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Keep Documents (days)
              </label>
              <input
                type="number"
                min="30"
                max="3650"
                value={formData.retentionSettings.keepDocuments}
                onChange={(e) => handleInputChange('retentionSettings.keepDocuments', Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Keep Activity Logs (days)
              </label>
              <input
                type="number"
                min="7"
                max="365"
                value={formData.retentionSettings.keepActivityLogs}
                onChange={(e) => handleInputChange('retentionSettings.keepActivityLogs', Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Auto-Delete Rejected Matches
              </label>
              <p className="text-xs text-gray-500">
                Automatically clean up rejected matches after 30 days
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.retentionSettings.autoDeleteRejected}
                onChange={(e) => handleInputChange('retentionSettings.autoDeleteRejected', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
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
            Save Organization Settings
          </button>
        </div>
      )}
    </SettingsSection>
  )
}