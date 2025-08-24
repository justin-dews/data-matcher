'use client'

import { useState, useRef, useEffect } from 'react'
import { CheckIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

interface InlineEditorProps {
  value: string
  isEditing: boolean
  onEdit: () => void
  onSave: (value: string) => void
  onCancel: () => void
  className?: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
}

export default function InlineEditor({
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  className = '',
  placeholder = '',
  multiline = false,
  maxLength
}: InlineEditorProps) {
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleSave = () => {
    if (editValue.trim() !== value) {
      onSave(editValue.trim())
    } else {
      onCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Enter' && multiline && e.metaKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input'
    
    return (
      <div className="relative">
        <InputComponent
          ref={inputRef as any}
          type={multiline ? undefined : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            'w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
            multiline ? 'resize-none min-h-[60px]' : 'h-8',
            className
          )}
          rows={multiline ? 3 : undefined}
        />
        
        {/* Action buttons */}
        <div className="absolute -right-16 top-0 flex items-center space-x-1">
          <button
            type="button"
            onClick={handleSave}
            className="p-1 text-green-600 hover:text-green-700 bg-white border border-gray-300 rounded shadow-sm"
            title="Save (Enter)"
          >
            <CheckIcon className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-red-600 hover:text-red-700 bg-white border border-gray-300 rounded shadow-sm"
            title="Cancel (Esc)"
          >
            <XMarkIcon className="h-3 w-3" />
          </button>
        </div>

        {/* Character count */}
        {maxLength && (
          <div className="absolute -bottom-5 right-0 text-xs text-gray-500">
            {editValue.length}/{maxLength}
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className={cn(
        'group relative cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 -mx-1 -my-0.5',
        className
      )}
      onClick={onEdit}
    >
      <span className={cn(
        'block',
        value === placeholder && 'text-gray-400 italic'
      )}>
        {value || placeholder}
      </span>
      
      {/* Edit icon */}
      <div className="absolute -right-5 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <PencilIcon className="h-3 w-3 text-gray-400" />
      </div>
    </div>
  )
}