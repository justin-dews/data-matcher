'use client'

import { MatchCandidate, Match, formatPercent, CONFIG } from '@/lib/utils'

interface ConfidenceScoreBreakdownProps {
  candidate?: MatchCandidate
  match?: Match | null
}

export default function ConfidenceScoreBreakdown({ candidate, match }: ConfidenceScoreBreakdownProps) {
  // Use match data if available, otherwise use candidate data
  const vectorScore = match?.vector_score ?? candidate?.vector_score ?? 0
  const trigramScore = match?.trigram_score ?? candidate?.trigram_score ?? 0
  const fuzzyScore = match?.fuzzy_score ?? candidate?.fuzzy_score ?? 0  // NEW: Added fuzzy score
  const aliasScore = match?.alias_score ?? candidate?.alias_score ?? 0
  const finalScore = match?.final_score ?? candidate?.final_score ?? 0
  const matchedVia = candidate?.matched_via ?? 'hybrid'

  const weights = {
    vector: CONFIG.MATCHING.VECTOR_WEIGHT,
    trigram: CONFIG.MATCHING.TRIGRAM_WEIGHT,
    fuzzy: CONFIG.MATCHING.FUZZY_WEIGHT,      // NEW: Added fuzzy weight
    alias: CONFIG.MATCHING.ALIAS_WEIGHT
  }

  const components = [
    {
      name: 'Vector Similarity',
      score: vectorScore,
      weight: weights.vector,
      description: 'Semantic similarity using AI embeddings (DISABLED)',
      color: 'gray',
      isPrimary: matchedVia === 'vector'
    },
    {
      name: 'Text Similarity',
      score: trigramScore,
      weight: weights.trigram,
      description: 'Character-level text matching (trigrams)',
      color: 'green',
      isPrimary: matchedVia === 'trigram'
    },
    {
      name: 'Fuzzy Matching',
      score: fuzzyScore,
      weight: weights.fuzzy,
      description: 'Fuzzy string similarity matching',
      color: 'orange',
      isPrimary: matchedVia === 'fuzzy'
    },
    {
      name: 'Alias Match',
      score: aliasScore,
      weight: weights.alias,
      description: 'Known competitor product mappings',
      color: 'purple',
      isPrimary: matchedVia === 'alias'
    }
  ]

  const getColorClasses = (color: string, isPrimary: boolean) => {
    const intensity = isPrimary ? '600' : '400'
    switch (color) {
      case 'blue':
        return `text-blue-${intensity} bg-blue-${isPrimary ? '50' : '25'}`
      case 'green':
        return `text-green-${intensity} bg-green-${isPrimary ? '50' : '25'}`
      case 'purple':
        return `text-purple-${intensity} bg-purple-${isPrimary ? '50' : '25'}`
      case 'orange':
        return `text-orange-${intensity} bg-orange-${isPrimary ? '50' : '25'}`
      case 'gray':
        return `text-gray-${intensity} bg-gray-${isPrimary ? '50' : '25'}`
      default:
        return `text-gray-${intensity} bg-gray-${isPrimary ? '50' : '25'}`
    }
  }

  const calculateWeightedScore = (score: number, weight: number) => score * weight

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">Match Confidence Breakdown</h4>
        <div className="text-sm font-semibold text-gray-700">
          Final Score: {formatPercent(finalScore)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {components.map((component) => (
          <div
            key={component.name}
            className={`p-4 rounded-lg border-2 ${
              component.isPrimary 
                ? 'border-current' 
                : 'border-gray-200'
            } ${getColorClasses(component.color, component.isPrimary)}`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="font-medium text-sm">
                  {component.name}
                  {component.isPrimary && (
                    <span className="ml-2 text-xs px-2 py-1 bg-current text-white rounded-full opacity-75">
                      Primary
                    </span>
                  )}
                </h5>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span>Raw Score:</span>
                  <span className="font-mono">{formatPercent(component.score)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span>Weight:</span>
                  <span className="font-mono">{component.weight}×</span>
                </div>
                
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span>Contribution:</span>
                    <span className="font-mono">
                      {formatPercent(calculateWeightedScore(component.score, component.weight))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full bg-current`}
                    style={{ width: `${component.score * 100}%` }}
                  />
                </div>
              </div>
              
              <p className="text-xs opacity-75 mt-2">
                {component.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-900">Calculation</h5>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="font-mono">
              Final Score = ({formatPercent(vectorScore)} × {weights.vector}) + ({formatPercent(trigramScore)} × {weights.trigram}) + ({formatPercent(fuzzyScore)} × {weights.fuzzy}) + ({formatPercent(aliasScore)} × {weights.alias})
            </div>
            <div className="font-mono">
              Final Score = {formatPercent(calculateWeightedScore(vectorScore, weights.vector))} + {formatPercent(calculateWeightedScore(trigramScore, weights.trigram))} + {formatPercent(calculateWeightedScore(fuzzyScore, weights.fuzzy))} + {formatPercent(calculateWeightedScore(aliasScore, weights.alias))}
            </div>
            <div className="font-mono font-semibold">
              Final Score = {formatPercent(finalScore)}
            </div>
          </div>
          
          {matchedVia !== 'hybrid' && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm">
                <span className="font-medium text-blue-800">Primary Match Method:</span>
                <span className="text-blue-700 ml-1 capitalize">{matchedVia}</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                This match was primarily identified through {matchedVia} similarity, 
                with other methods providing supporting evidence.
              </p>
            </div>
          )}
        </div>
      </div>

      {match?.reasoning && (
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h5 className="text-sm font-medium text-yellow-800 mb-2">Match Reasoning</h5>
          <p className="text-sm text-yellow-700">{match.reasoning}</p>
        </div>
      )}
    </div>
  )
}