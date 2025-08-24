import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json()

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      )
    }

    // Test connection based on provider
    let isValid = false

    if (provider === 'openai') {
      // Test OpenAI connection
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      isValid = response.ok
    } else if (provider === 'anthropic') {
      // Test Anthropic connection - using a simple message request
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Test'
            }
          ]
        })
      })
      isValid = response.ok
    }

    if (isValid) {
      return NextResponse.json({ success: true, message: 'Connection successful' })
    } else {
      return NextResponse.json(
        { error: 'Invalid API key or connection failed' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Connection test error:', error)
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    )
  }
}