import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/options'
import { getUserProviderTokens, saveUserProviderToken } from '@/app/lib/supabase-utils'
import supabase from '@/app/lib/supabase'

// GET route to fetch provider tokens for the current user
export async function GET(request: NextRequest) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions)
    
    // Check if user is authenticated
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get provider tokens from the database
    const result = await getUserProviderTokens(session.user.email)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to retrieve provider tokens' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ tokens: result.tokens })
  } catch (error) {
    console.error('Error in provider tokens API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST route to save a provider token
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const email = session.user.email
    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      )
    }

    // Parse the request body
    const body = await request.json()
    const { provider, accessToken, username } = body

    // Validate required fields
    if (!provider || !accessToken) {
      return NextResponse.json(
        { error: 'Provider and accessToken are required' },
        { status: 400 }
      )
    }

    console.log(`API: Saving ${provider} token for user: ${email}`)

    // Upsert the token into the database
    const { error } = await supabase
      .from('user_provider_tokens')
      .upsert({
        email,
        provider,
        access_token: accessToken,
        username: username || null,
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
    console.error('Error saving provider token:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 