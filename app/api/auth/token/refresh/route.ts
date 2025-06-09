import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/options';
import { createClient } from '@/app/lib/supabase-server';
import axios from 'axios';

const supabase = createClient();

/**
 * API endpoint to refresh tokens for various Git providers
 * This endpoint will:
 * 1. Check if a token needs refreshing based on expiry time
 * 2. Use the appropriate refresh flow for each provider
 * 3. Update the database with the new token
 * 4. Return the refreshed token information
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const email = session.user.email;
    
    // Get the provider from the request body
    const body = await request.json();
    const { provider, email: bodyEmail } = body;
    
    // Use the email from the session by default, but allow override if provided
    const userEmail = bodyEmail || email;
    
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    console.log(`Attempting to refresh ${provider} token for ${userEmail}`);
    
    // Get the current token information from the database
    const { data: tokenData, error: fetchError } = await supabase
      .from('user_provider_tokens')
      .select('*')
      .eq('email', userEmail)
      .eq('provider', provider)
      .single();
    
    if (fetchError || !tokenData) {
      console.error(`No token found for ${provider}:`, fetchError);
      return NextResponse.json(
        { error: `No token found for ${provider}` },
        { status: 404 }
      );
    }

    // Check if token is already valid and not expired
    const now = new Date();
    if (
      tokenData.is_valid && 
      tokenData.last_validated_at && 
      new Date(tokenData.last_validated_at).getTime() > now.getTime() - 10 * 60 * 1000
    ) {
      console.log(`${provider} token is still valid until ${tokenData.last_validated_at}`);
      return NextResponse.json({
        provider,
        token: tokenData.access_token,
        username: tokenData.username,
        isValid: true
      });
    }

    // Attempt to refresh the token based on provider
    switch (provider) {
      case 'github':
        return await refreshGitHubToken(userEmail, tokenData);
      case 'gitlab':
        return await refreshGitLabToken(userEmail, tokenData);
      // Add cases for other providers as needed
      default:
        return NextResponse.json(
          { error: `Refresh not implemented for provider: ${provider}` },
          { status: 501 }
        );
    }
  } catch (error) {
    console.error('Error in token refresh API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during token refresh' },
      { status: 500 }
    );
  }
}

/**
 * Refresh a GitHub token
 * Note: GitHub OAuth doesn't provide refresh tokens by default,
 * so this is more about validation and re-authentication if needed
 */
async function refreshGitHubToken(email: string, tokenData: any) {
  try {
    // Validate the existing token with GitHub API
    const validationResponse = await axios.get('https://api.github.com/user', {
      headers: { 'Authorization': `token ${tokenData.access_token}` },
      validateStatus: (status) => true // Accept any status to check
    });

    if (validationResponse.status === 200) {
      // Token is valid, update last_validated_at
      const { error } = await supabase
        .from('user_provider_tokens')
        .update({
          is_valid: true,
          last_validated_at: new Date().toISOString()
        })
        .eq('email', email)
        .eq('provider', 'github');
      
      if (error) {
        console.error('Error updating GitHub token validation:', error);
      }
      
      return NextResponse.json({
        provider: 'github',
        token: tokenData.access_token,
        username: tokenData.username,
        isValid: true
      });
    } else {
      // Token is invalid, mark it as such
      const { error } = await supabase
        .from('user_provider_tokens')
        .update({
          is_valid: false,
          last_validated_at: new Date().toISOString()
        })
        .eq('email', email)
        .eq('provider', 'github');
      
      return NextResponse.json(
        { 
          error: 'GitHub token is invalid, user needs to re-authenticate', 
          isValid: false 
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error refreshing GitHub token:', error);
    
    // Mark token as invalid
    await supabase
      .from('user_provider_tokens')
      .update({
        is_valid: false,
        last_validated_at: new Date().toISOString()
      })
      .eq('email', email)
      .eq('provider', 'github');
      
    return NextResponse.json(
      { error: 'GitHub token validation failed', isValid: false },
      { status: 401 }
    );
  }
}

/**
 * Refresh a GitLab token using the refresh token flow
 * This uses GitLab's OAuth refresh token capabilities
 */
async function refreshGitLabToken(email: string, tokenData: any) {
  try {
    // Check if we have a refresh token
    if (!tokenData.refresh_token) {
      // No refresh token, mark as invalid and require re-authentication
      await supabase
        .from('user_provider_tokens')
        .update({
          is_valid: false,
          last_validated_at: new Date().toISOString()
        })
        .eq('email', email)
        .eq('provider', 'gitlab');
        
      return NextResponse.json(
        { 
          error: 'No GitLab refresh token available, user needs to re-authenticate', 
          isValid: false 
        },
        { status: 401 }
      );
    }
    
    // Use the refresh token to get a new access token
    // GitLab expects form-encoded parameters, not JSON in the request body
    const params = new URLSearchParams({
      client_id: process.env.GITLAB_CLIENT_ID || '',
      client_secret: process.env.GITLAB_CLIENT_SECRET || '',
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/gitlab`
    });
    
    const response = await axios.post('https://gitlab.com/oauth/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.status === 200 && response.data.access_token) {
      // Calculate expiry time (GitLab tokens typically expire in 2 hours)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (response.data.expires_in || 7200));
      
      // Update the token in the database
      const { error } = await supabase
        .from('user_provider_tokens')
        .update({
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token || tokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          is_valid: true,
          last_validated_at: new Date().toISOString()
        })
        .eq('email', email)
        .eq('provider', 'gitlab');
      
      if (error) {
        console.error('Error updating GitLab token:', error);
        return NextResponse.json(
          { error: 'Failed to update GitLab token in database' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        provider: 'gitlab',
        token: response.data.access_token,
        refreshToken: response.data.refresh_token || tokenData.refresh_token,
        username: tokenData.username,
        isValid: true,
        expiresAt: expiresAt.toISOString()
      });
    } else {
      // Failed to refresh, mark as invalid
      await supabase
        .from('user_provider_tokens')
        .update({
          is_valid: false,
          last_validated_at: new Date().toISOString()
        })
        .eq('email', email)
        .eq('provider', 'gitlab');
        
      return NextResponse.json(
        { error: 'Failed to refresh GitLab token', isValid: false },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error refreshing GitLab token:', error);
    
    // Log more detailed error information
    if (axios.isAxiosError(error)) {
      console.error('GitLab token refresh API error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
    }
    
    // Mark token as invalid
    await supabase
      .from('user_provider_tokens')
      .update({
        is_valid: false,
        last_validated_at: new Date().toISOString()
      })
      .eq('email', email)
      .eq('provider', 'gitlab');
      
    return NextResponse.json(
      { error: 'GitLab token refresh failed', isValid: false },
      { status: 401 }
    );
  }
} 