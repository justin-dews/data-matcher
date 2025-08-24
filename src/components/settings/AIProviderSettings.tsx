'use client'

import { useState } from 'react'
import { EyeIcon, EyeSlashIcon, KeyIcon, SparklesIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SettingsSection from './SettingsSection'

interface AIProviderSettingsProps {
  settings: {
    openai_api_key?: string
    anthropic_api_key?: string
    preferred_provider: 'openai' | 'anthropic'
    default_model: string
  }
  onSave: (key: string, value: any) => Promise<void>
  onSaveMultiple: (settings: Record<string, any>) => Promise<void>
  loading: boolean
}

export default function AIProviderSettings({
  settings,
  onSave,
  onSaveMultiple,
  loading
}: AIProviderSettingsProps) {
  const [formData, setFormData] = useState(settings)
  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false
  })
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{
    openai?: 'success' | 'error' | null
    anthropic?: 'success' | 'error' | null
  }>({})

  const providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT models for text generation and embeddings',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      keyField: 'openai_api_key'
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude models for advanced reasoning',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      keyField: 'anthropic_api_key'
    }
  ]

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveField = async (field: string, value: any) => {
    await onSave(field, value)
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveAll = async () => {
    await onSaveMultiple(formData)
  }

  const testConnection = async (providerId: 'openai' | 'anthropic') => {
    setTestingConnection(true)
    setConnectionStatus(prev => ({
      ...prev,
      [providerId]: null
    }))

    try {
      const apiKey = formData[`${providerId}_api_key` as keyof typeof formData] as string
      if (!apiKey) {
        throw new Error('API key is required')
      }

      // Test the connection by making a simple API call
      const response = await fetch(`/api/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: providerId,
          apiKey: apiKey
        })
      })

      if (response.ok) {
        setConnectionStatus(prev => ({
          ...prev,
          [providerId]: 'success'
        }))
      } else {
        throw new Error('Connection failed')
      }
    } catch (error) {
      setConnectionStatus(prev => ({
        ...prev,
        [providerId]: 'error'
      }))
    } finally {
      setTestingConnection(false)
    }
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(formData)

  return (
    <SettingsSection
      title="AI Provider Configuration"
      description="Configure your AI providers and models for intelligent document matching"
    >
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Preferred Provider
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {providers.map((provider) => (
            <label key={provider.id} className="relative">
              <input
                type="radio"
                name="preferred_provider"
                value={provider.id}
                checked={formData.preferred_provider === provider.id}
                onChange={(e) => handleInputChange('preferred_provider', e.target.value)}
                className="sr-only"
              />
              <div className={`cursor-pointer rounded-lg border p-4 ${
                formData.preferred_provider === provider.id
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <div className="flex items-center">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{provider.name}</div>
                    <div className="text-gray-500">{provider.description}</div>
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* API Key Configuration */}
      {providers.map((provider) => (
        <div key={provider.id} className="space-y-4">
          <div className="flex items-center space-x-2">
            <KeyIcon className="h-5 w-5 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-900">
              {provider.name} API Key
            </h4>
            {formData.preferred_provider === provider.id && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Primary
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  type={showKeys[provider.id as keyof typeof showKeys] ? 'text' : 'password'}
                  value={formData[provider.keyField as keyof typeof formData] as string || ''}
                  onChange={(e) => handleInputChange(provider.keyField, e.target.value)}
                  placeholder={`Enter your ${provider.name} API key`}
                  className="block w-full rounded-md border-gray-300 pr-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(prev => ({
                    ...prev,
                    [provider.id]: !prev[provider.id as keyof typeof prev]
                  }))}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showKeys[provider.id as keyof typeof showKeys] ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => testConnection(provider.id as 'openai' | 'anthropic')}
                disabled={!formData[provider.keyField as keyof typeof formData] || testingConnection}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {testingConnection ? (
                  <LoadingSpinner size="sm" className="mr-1" />
                ) : (
                  <SparklesIcon className="h-4 w-4 mr-1" />
                )}
                Test
              </button>
            </div>

            {/* Connection Status */}
            {connectionStatus[provider.id as keyof typeof connectionStatus] && (
              <div className={`text-sm ${
                connectionStatus[provider.id as keyof typeof connectionStatus] === 'success'
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {connectionStatus[provider.id as keyof typeof connectionStatus] === 'success'
                  ? '✓ Connection successful'
                  : '✗ Connection failed - please check your API key'}
              </div>
            )}

            {/* Save Button for API Key */}
            <button
              type="button"
              onClick={() => handleSaveField(provider.keyField, formData[provider.keyField as keyof typeof formData])}
              disabled={loading || !formData[provider.keyField as keyof typeof formData]}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        </div>
      ))}

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default Model
        </label>
        <select
          value={formData.default_model}
          onChange={(e) => handleInputChange('default_model', e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          {providers
            .find(p => p.id === formData.preferred_provider)
            ?.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
          This model will be used for generating embeddings and matching analysis
        </p>
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <KeyIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Security Notice
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                API keys are encrypted and stored securely. They are only used for making requests to the respective AI providers and are never shared or logged in plain text.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save All Changes */}
      {hasChanges && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading && <LoadingSpinner size="sm" className="mr-2" />}
            Save All Changes
          </button>
        </div>
      )}
    </SettingsSection>
  )
}