import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabaseAdmin } from '@/lib/supabase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { text, productId } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Generate embedding using OpenAI's text-embedding-ada-002 model
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.slice(0, 8192), // Limit to model's context window
    })

    const embedding = response.data[0].embedding

    // If productId is provided, save to database
    if (productId) {
      const { error: dbError } = await supabaseAdmin
        .from('product_embeddings')
        .insert({
          product_id: productId,
          embedding,
          text_content: text.slice(0, 8192)
        })
      
      if (dbError) {
        console.error('Error saving embedding to database:', dbError)
        // Still return the embedding even if DB save fails
      }
    }

    return NextResponse.json({ embedding })
  } catch (error: any) {
    console.error('Error generating embedding:', error)
    
    if (error?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid OpenAI API key' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate embedding' },
      { status: 500 }
    )
  }
}