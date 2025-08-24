'use client'

import { DocumentTextIcon, ReceiptPercentIcon, ClipboardDocumentListIcon, DocumentIcon, CogIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

export type ParsePreset = 'invoice' | 'receipt' | 'packing_slip' | 'purchase_order' | 'custom'

interface ParsePresetSelectorProps {
  selectedPreset: ParsePreset
  onPresetChange: (preset: ParsePreset) => void
}

const presets = [
  {
    id: 'invoice' as ParsePreset,
    name: 'Invoice',
    description: 'Invoices with line items, quantities, and prices',
    icon: DocumentTextIcon,
    fields: ['description', 'quantity', 'unit_price', 'total_price', 'sku'],
  },
  {
    id: 'receipt' as ParsePreset,
    name: 'Receipt',
    description: 'Retail receipts with items and totals',
    icon: ReceiptPercentIcon,
    fields: ['description', 'quantity', 'unit_price', 'total_price'],
  },
  {
    id: 'packing_slip' as ParsePreset,
    name: 'Packing Slip',
    description: 'Shipping documents with items and quantities',
    icon: ClipboardDocumentListIcon,
    fields: ['description', 'quantity', 'sku', 'uom'],
  },
  {
    id: 'purchase_order' as ParsePreset,
    name: 'Purchase Order',
    description: 'Purchase orders with detailed line items',
    icon: DocumentIcon,
    fields: ['description', 'quantity', 'unit_price', 'total_price', 'sku', 'uom'],
  },
  {
    id: 'custom' as ParsePreset,
    name: 'Custom',
    description: 'General document parsing with flexible extraction',
    icon: CogIcon,
    fields: ['description', 'quantity', 'unit_price', 'total_price'],
  },
]

export default function ParsePresetSelector({ selectedPreset, onPresetChange }: ParsePresetSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {presets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onPresetChange(preset.id)}
          className={cn(
            'text-left p-4 border rounded-lg transition-all hover:border-gray-300',
            selectedPreset === preset.id
              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
              : 'border-gray-200 hover:bg-gray-50'
          )}
        >
          <div className="flex items-start space-x-3">
            <div className={cn(
              'p-2 rounded-lg',
              selectedPreset === preset.id
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-600'
            )}>
              <preset.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className={cn(
                  'font-medium',
                  selectedPreset === preset.id ? 'text-blue-900' : 'text-gray-900'
                )}>
                  {preset.name}
                </h3>
                {selectedPreset === preset.id && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </div>
              <p className={cn(
                'text-sm mt-1',
                selectedPreset === preset.id ? 'text-blue-700' : 'text-gray-500'
              )}>
                {preset.description}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {preset.fields.map((field) => (
                  <span
                    key={field}
                    className={cn(
                      'inline-block px-2 py-1 text-xs rounded-full',
                      selectedPreset === preset.id
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-gray-200 text-gray-600'
                    )}
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}