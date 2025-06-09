import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/options';
import { createClient } from '@/app/lib/supabase-server';
import axios from 'axios';

const supabase = createClient();

/**
 * API endpoint to validate tokens for various Git providers
 * This endpoint will:
 * 1. Check if a token is valid by making a lightweight API call to the provider
 * 2. Return validation status and whether a refresh is needed
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
    
    // Get the provider and token from the request body
    const body = await request.json();
    const { provider, token, email: bodyEmail } = body;
    
    // Use the email from the session by default, but allow override if provided
    const userEmail = bodyEmail || email;
    
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // console.log(`Validating ${provider} token for ${userEmail}`);
    
    try {
      switch (provider) {
        case 'github':
          return await validateGitHubToken(userEmail, token);
        case 'gitlab':
          return await validateGitLabToken(userEmail, token);
        // Add cases for other providers as needed
        default:
          return NextResponse.json(
            { error: `Validation not implemented for provider: ${provider}` },
            { status: 501 }
          );
      }
    } catch (error: any) {
      // console.error(`Error validating ${provider} token:`, error);
      
      // Log more detailed error info for GitLab
      if (provider === 'gitlab' && axios.isAxiosError(error) && error.response) {
        console.error('GitLab validation error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers['www-authenticate']
        });
      }
      
      // Check for specific error statuses
      const status = error.response?.status;
      const errorData = error.response?.data;
      
      // Update the database if the token is from there
      if (token) {
        try {
          const { data } = await supabase
            .from('user_provider_tokens')
            .select('*')
            .eq('email', userEmail)
            .eq('provider', provider);
            
          if (data && data.length > 0) {
            // Only update if a token was found
            await supabase
              .from('user_provider_tokens')
              .update({
                is_valid: false,
                last_validated_at: new Date().toISOString()
              })
              .eq('email', userEmail)
              .eq('provider', provider);
          }
        } catch (dbError) {
          console.error('Error updating token status in database:', dbError);
        }
      }
      
      // Check specifically for expired token errors from GitLab
      if (provider === 'gitlab' && status === 401 && 
          (errorData?.error === 'invalid_token' || 
           error.response?.headers['www-authenticate']?.includes('error="invalid_token"'))) {
        
        return NextResponse.json({
          isValid: false,
          error: 'GitLab token is expired',
          needsRefresh: true,
          errorDetails: errorData
        });
      } else if (status === 401) {
        return NextResponse.json({
          isValid: false,
          error: `${provider} token is unauthorized`,
          needsRefresh: true
        });
      } else {
        return NextResponse.json({
          isValid: false,
          error: `Error validating ${provider} token: ${error.message}`
        });
      }
    }
  } catch (error) {
    console.error('Error in token validation API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during token validation' },
      { status: 500 }
    );
  }
}

/**
 * Validate a GitHub token by making a lightweight API call
 */
async function validateGitHubToken(email: string, token: string) {
  try {
    // Validate the token with GitHub API
    const response = await axios.get('https://api.github.com/user', {
      headers: { 'Authorization': `token ${token}` }
    });

    if (response.status === 200) {
      // Update token status in database if it exists
      const { data } = await supabase
        .from('user_provider_tokens')
        .select('*')
        .eq('email', email)
        .eq('provider', 'github');
      
      if (data && data.length > 0) {
        await supabase
          .from('user_provider_tokens')
          .update({
            is_valid: true,
            last_validated_at: new Date().toISOString()
          })
          .eq('email', email)
          .eq('provider', 'github');
      }
      
      return NextResponse.json({
        isValid: true,
        username: response.data.login
      });
    } else {
      throw new Error(`GitHub API returned status ${response.status}`);
    }
  } catch (error) {
    // Let the main error handler deal with this
    throw error;
  }
}

/**
 * Validate a GitLab token by making a lightweight API call
 */
async function validateGitLabToken(email: string, token: string) {
  try {
    // Validate the token with GitLab API
    const response = await axios.get('https://gitlab.com/api/v4/user', {
      headers: { 'Authorization': `Bearer ${token}` },
      validateStatus: (status) => true // Accept any status to properly handle errors
    });

    if (response.status === 200) {
      // Check if the token is in database
      const { data } = await supabase
        .from('user_provider_tokens')
        .select('*')
        .eq('email', email)
        .eq('provider', 'gitlab');
      
      if (data && data.length > 0) {
        // Check if token is close to expiring
        const tokenData = data[0];
        const now = new Date();
        const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at) : null;
        
        // If expiry is less than 15 minutes away, suggest a refresh
        const needsRefresh = expiresAt && 
          (expiresAt.getTime() - now.getTime() < 15 * 60 * 1000);
        
        await supabase
          .from('user_provider_tokens')
          .update({
            is_valid: true,
            last_validated_at: now.toISOString()
          })
          .eq('email', email)
          .eq('provider', 'gitlab');
        
        return NextResponse.json({
          isValid: true,
          username: response.data.username,
          needsRefresh
        });
      } else {
        // Token is valid but not in our database
        return NextResponse.json({
          isValid: true,
          username: response.data.username
        });
      }
    } else if (response.status === 401) {
      // Handle expired tokens more explicitly
      const isExpiredToken = 
        response.data?.error === 'invalid_token' || 
        response.headers['www-authenticate']?.includes('error="invalid_token"');
      
      if (isExpiredToken) {
        throw new Error(`GitLab token is expired and needs to be refreshed`);
      } else {
        throw new Error(`GitLab API unauthorized: ${JSON.stringify(response.data)}`);
      }
    } else {
      throw new Error(`GitLab API returned status ${response.status}: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    // Let the main error handler deal with this
    throw error;
  }
} 