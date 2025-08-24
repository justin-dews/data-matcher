'use client'

import { useState } from 'react'
import { AdjustmentsHorizontalIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SettingsSection from './SettingsSection'
import { formatPercent } from '@/lib/utils'

interface MatchingThresholdsProps {
  settings: {
    vector_weight: number
    trigram_weight: number
    alias_weight: number
    auto_approve_threshold: number
    confidence_threshold: number
  }
  onSave: (key: string, value: any) => Promise<void>
  onSaveMultiple: (settings: Record<string, any>) => Promise<void>
  loading: boolean
}

export default function MatchingThresholds({
  settings,
  onSave,
  onSaveMultiple,
  loading
}: MatchingThresholdsProps) {
  const [formData, setFormData] = useState(settings)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleInputChange = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveAll = async () => {
    await onSaveMultiple(formData)
  }

  const resetToDefaults = () => {
    const defaults = {
      vector_weight: 0.6,
      trigram_weight: 0.3,
      alias_weight: 0.2,
      auto_approve_threshold: 0.9,
      confidence_threshold: 0.4
    }
    setFormData(defaults)
  }

  const getThresholdLabel = (threshold: number) => {
    if (threshold >= 0.9) return 'Very Conservative'
    if (threshold >= 0.8) return 'Conservative'
    if (threshold >= 0.7) return 'Balanced'
    if (threshold >= 0.6) return 'Aggressive'
    return 'Very Aggressive'
  }

  const getThresholdColor = (threshold: number) => {
    if (threshold >= 0.9) return 'text-green-600 bg-green-50'
    if (threshold >= 0.8) return 'text-green-600 bg-green-50'
    if (threshold >= 0.7) return 'text-yellow-600 bg-yellow-50'
    if (threshold >= 0.6) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  const presets = [
    {
      name: 'Conservative',
      description: 'High precision, minimal false matches',
      values: {
        vector_weight: 0.7,
        trigram_weight: 0.2,
        alias_weight: 0.3,
        auto_approve_threshold: 0.95,
        confidence_threshold: 0.6
      }
    },
    {
      name: 'Balanced',
      description: 'Good balance of precision and automation',
      values: {
        vector_weight: 0.6,
        trigram_weight: 0.3,
        alias_weight: 0.2,
        auto_approve_threshold: 0.8,
        confidence_threshold: 0.4
      }
    },
    {
      name: 'Aggressive',
      description: 'Higher automation, more matches to review',
      values: {
        vector_weight: 0.5,
        trigram_weight: 0.4,
        alias_weight: 0.3,
        auto_approve_threshold: 0.65,
        confidence_threshold: 0.3
      }
    }
  ]

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(formData)

  return (
    <SettingsSection
      title="Matching Configuration"
      description="Configure how PathoptMatch analyzes and scores potential product matches"
    >
      {/* Auto-Approval Threshold */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auto-Approval Threshold
          </label>
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0.4"
                  max="0.99"
                  step="0.01"
                  value={formData.auto_approve_threshold}
                  onChange={(e) => handleInputChange('auto_approve_threshold', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((formData.auto_approve_threshold - 0.4) / (0.99 - 0.4)) * 100}%, #e5e7eb ${((formData.auto_approve_threshold - 0.4) / (0.99 - 0.4)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>
              <div className="text-sm font-medium text-gray-900 min-w-[80px] text-right">
                {formatPercent(formData.auto_approve_threshold)}
              </div>
            </div>
            
            <div className={`px-3 py-2 rounded-md ${getThresholdColor(formData.auto_approve_threshold)}`}>
              <div className="text-sm font-medium">
                {getThresholdLabel(formData.auto_approve_threshold)}
              </div>
              <div className="text-xs mt-1 opacity-75">
                {formData.auto_approve_threshold >= 0.9
                  ? "Very high confidence required. Minimal false positives, more manual review."
                  : formData.auto_approve_threshold >= 0.8
                  ? "High confidence required. Good balance of automation and accuracy."
                  : formData.auto_approve_threshold >= 0.7
                  ? "Moderate confidence required. Balanced approach to automation."
                  : formData.auto_approve_threshold >= 0.6
                  ? "Lower confidence threshold. More automation, some manual review needed."
                  : "Very low threshold. Maximum automation, requires post-processing review."}
              </div>
            </div>
          </div>
        </div>

        {/* Confidence Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Confidence Threshold
          </label>
          <div className="space-y-2">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={formData.confidence_threshold}
                  onChange={(e) => handleInputChange('confidence_threshold', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="text-sm font-medium text-gray-900 min-w-[80px] text-right">
                {formatPercent(formData.confidence_threshold)}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Matches below this threshold will not be shown to users
            </p>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Quick Presets
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setFormData(preset.values)}
              className="text-left p-4 border rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-gray-900">{preset.name}</div>
              <div className="text-sm text-gray-600 mt-1">{preset.description}</div>
              <div className="text-xs text-gray-500 mt-2">
                Auto-approval: {formatPercent(preset.values.auto_approve_threshold)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Weight Configuration */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
          Advanced Weight Configuration
          <span className="ml-2 text-xs text-gray-500">
            ({showAdvanced ? 'Hide' : 'Show'})
          </span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-6 border-l-2 border-gray-200 pl-4">
            {/* Vector Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vector Similarity Weight ({formatPercent(formData.vector_weight)})
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={formData.vector_weight}
                onChange={(e) => handleInputChange('vector_weight', Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Weight for AI embedding similarity (semantic matching)
              </p>
            </div>

            {/* Trigram Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Similarity Weight ({formatPercent(formData.trigram_weight)})
              </label>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={formData.trigram_weight}
                onChange={(e) => handleInputChange('trigram_weight', Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Weight for character-level text similarity (fuzzy matching)
              </p>
            </div>

            {/* Alias Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Known Alias Weight ({formatPercent(formData.alias_weight)})
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={formData.alias_weight}
                onChange={(e) => handleInputChange('alias_weight', Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bonus weight for previously confirmed competitor mappings
              </p>
            </div>

            {/* Weight Sum Warning */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex">
                <InformationCircleIcon className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="ml-3 text-sm text-blue-700">
                  <p>
                    <strong>Total Weight:</strong> {formatPercent(formData.vector_weight + formData.trigram_weight + formData.alias_weight)}
                  </p>
                  <p className="mt-1">
                    Weights don't need to sum to 100%. The final score is normalized automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reset to Defaults */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Reset to Defaults
        </button>
        
        {hasChanges && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading && <LoadingSpinner size="sm" className="mr-2" />}
            Save Matching Settings
          </button>
        )}
      </div>
    </SettingsSection>
  )
}