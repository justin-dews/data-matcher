'use client'

import { useState } from 'react'
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { formatPercent } from '@/lib/utils'

interface ThresholdControlProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export default function ThresholdControl({
  value,
  onChange,
  min = 0.4,
  max = 0.99,
  step = 0.05
}: ThresholdControlProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const presets = [
    { label: 'Conservative', value: 0.95, description: 'Only auto-approve very high confidence matches' },
    { label: 'Balanced', value: 0.8, description: 'Good balance between automation and accuracy' },
    { label: 'Aggressive', value: 0.6, description: 'Auto-approve more matches, review later' },
  ]

  const getThresholdColor = (threshold: number) => {
    if (threshold >= 0.9) return 'text-green-600 bg-green-50 border-green-200'
    if (threshold >= 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-orange-600 bg-orange-50 border-orange-200'
  }

  const getThresholdLabel = (threshold: number) => {
    if (threshold >= 0.9) return 'Conservative'
    if (threshold >= 0.7) return 'Balanced'
    return 'Aggressive'
  }

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
        Auto-Match: {formatPercent(value)}
        <span className="ml-2 text-xs text-gray-500">({getThresholdLabel(value)})</span>
      </button>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Auto-Match Threshold
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Matches with confidence above this threshold will be automatically approved
              </p>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
              
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`
                }}
              />
              
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatPercent(min)}</span>
                <span className="font-medium text-gray-700">{formatPercent(value)}</span>
                <span>{formatPercent(max)}</span>
              </div>
            </div>

            {/* Current Setting */}
            <div className={`p-3 rounded-lg border ${getThresholdColor(value)}`}>
              <div className="text-sm font-medium">
                Current Setting: {getThresholdLabel(value)} ({formatPercent(value)})
              </div>
              <div className="text-xs mt-1 opacity-75">
                {value >= 0.9 
                  ? "Very high confidence required. Minimal false positives, but more manual review needed."
                  : value >= 0.7
                  ? "Balanced approach. Good accuracy with moderate automation."
                  : "Lower threshold allows more automation but may require more post-review."}
              </div>
            </div>

            {/* Preset Buttons */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-700">Quick Presets:</h4>
              <div className="grid grid-cols-1 gap-1">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => onChange(preset.value)}
                    className={`text-left p-2 rounded text-sm transition-colors ${
                      Math.abs(value - preset.value) < 0.01
                        ? 'bg-blue-50 border border-blue-200 text-blue-800'
                        : 'hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="font-medium">
                      {preset.label} ({formatPercent(preset.value)})
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}