'use client'

import { CheckCircleIcon, CloudArrowUpIcon, CogIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'

export type ParseStatus = 'idle' | 'uploading' | 'parsing' | 'completed' | 'failed'

interface ParsingProgressProps {
  status: ParseStatus
  progress: number
  filename: string
}

const steps = [
  {
    id: 'uploading',
    name: 'Uploading',
    description: 'Uploading file to secure storage',
    icon: CloudArrowUpIcon,
    minProgress: 10,
    maxProgress: 40,
  },
  {
    id: 'parsing',
    name: 'Parsing',
    description: 'Extracting data with AI',
    icon: CogIcon,
    minProgress: 40,
    maxProgress: 100,
  },
]

export default function ParsingProgress({ status, progress, filename }: ParsingProgressProps) {
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === status)
  }

  const isStepCompleted = (stepIndex: number) => {
    const currentIndex = getCurrentStepIndex()
    return currentIndex > stepIndex || (currentIndex === stepIndex && progress >= steps[stepIndex].maxProgress)
  }

  const isStepActive = (stepIndex: number) => {
    return getCurrentStepIndex() === stepIndex
  }

  const getStepProgress = (stepIndex: number) => {
    if (!isStepActive(stepIndex)) return 0
    
    const step = steps[stepIndex]
    const relativeProgress = ((progress - step.minProgress) / (step.maxProgress - step.minProgress)) * 100
    return Math.max(0, Math.min(100, relativeProgress))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Processing Document
        </h3>
        <p className="text-gray-600 break-all">{filename}</p>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const completed = isStepCompleted(index)
          const active = isStepActive(index)
          const stepProgress = getStepProgress(index)

          return (
            <div key={step.id} className="flex items-start space-x-4">
              {/* Step Icon */}
              <div className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                completed
                  ? 'bg-green-100 text-green-600'
                  : active
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-400'
              )}>
                {completed ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  <step.icon className={cn(
                    'w-5 h-5',
                    active && 'animate-pulse'
                  )} />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={cn(
                    'font-medium',
                    completed ? 'text-green-900' : active ? 'text-blue-900' : 'text-gray-500'
                  )}>
                    {step.name}
                  </h4>
                  {active && (
                    <span className="text-sm text-blue-600 font-medium">
                      {Math.round(stepProgress)}%
                    </span>
                  )}
                </div>
                <p className={cn(
                  'text-sm',
                  completed ? 'text-green-700' : active ? 'text-blue-700' : 'text-gray-500'
                )}>
                  {step.description}
                </p>

                {/* Step Progress Bar */}
                {active && (
                  <div className="mt-2 w-full bg-blue-100 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${stepProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Processing Message */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          {status === 'uploading' && 'Uploading your document securely...'}
          {status === 'parsing' && 'AI is analyzing your document and extracting data...'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          This may take a few moments depending on document complexity
        </p>
      </div>
    </div>
  )
}