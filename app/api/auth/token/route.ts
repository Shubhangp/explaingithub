import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../options'
import { createClient } from '@/app/lib/supabase-server'

// GET endpoint to retrieve all tokens for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const email = session.user.email
    const supabase = createClient()
    
    // Get all tokens for the user
    const { data, error } = await supabase
      .from('user_provider_tokens')
      .select('provider, access_token, refresh_token, expires_at, username, is_valid')
      .eq('email', email)
    
    if (error) {
      console.error('Error fetching user tokens:', error)
      return NextResponse.json(
        { error: 'Failed to fetch provider tokens' },
        { status: 500 }
      )
    }
    
    // Format response to match the format expected by the client
    const response = data.reduce((acc, token) => {
      acc[token.provider] = {
        token: token.access_token,
        refreshToken: token.refresh_token || undefined,
        expiresAt: token.expires_at ? new Date(token.expires_at).getTime() : undefined,
        provider: token.provider,
        userId: token.username,
        isValid: token.is_valid
      }
      return acc
    }, {} as Record<string, any>)
    
    return NextResponse.json({
      tokens: response
    })
  } catch (error) {
    console.error('Error in GET /api/auth/token:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// PUT endpoint to save a token for the authenticated user
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const email = session.user.email
    
    // Parse request body
    const body = await request.json()
    const { provider, token, refreshToken, username } = body
    
    // Validate required fields
    if (!provider || !token) {
      return NextResponse.json(
        { error: 'Provider and token are required' },
        { status: 400 }
      )
    }
    
    console.log(`Saving ${provider} token for ${email}`)
    
    // Calculate expiry date if appropriate
    let expiresAt = null
    if (provider === 'gitlab') {
      // GitLab tokens typically expire in 2 hours
      const twoHoursFromNow = new Date()
      twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2)
      expiresAt = twoHoursFromNow.toISOString()
    }
    
    const supabase = createClient()
    
    // Upsert the token into the database
    const { error } = await supabase
      .from('user_provider_tokens')
      .upsert({
        email,
        provider,
        access_token: token,
        refresh_token: refreshToken || null,
        expires_at: expiresAt,
        username: username || null,
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'email,provider'
      })
    
    if (error) {
      console.error(`Error saving ${provider} token:`, error)
      return NextResponse.json(
        { error: `Failed to save ${provider} token` },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: `${provider} token saved successfully`
    })
  } catch (error) {
    console.error('Error in PUT /api/auth/token:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 