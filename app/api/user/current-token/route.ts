import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/auth/auth-options';
import supabase from '@/app/lib/supabase';
import axios from 'axios';
import { getGithubToken, getGitlabToken, getBitbucketToken, getAzureToken } from "@/app/auth";
import { cookies } from "next/headers";
import { createClient } from '@/utils/supabase/server';
import { parseUserFromCookies } from "@/utils/user-utils";

// Add a simple in-memory cache for token validation results
const validationCache = new Map<string, { isValid: boolean, timestamp: number, token: string }>();
const VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the provider from query parameters
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');
    
    if (!provider) {
      return NextResponse.json(
        { error: 'Provider parameter is required' },
        { status: 400 }
      );
    }

    const email = session.user.email;
    if (!email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    console.log(`API: Getting current token for ${provider} (user: ${email})`);

    // Check cache first
    const cacheKey = `${email}_${provider}`;
    const cachedResult = validationCache.get(cacheKey);
    
    if (cachedResult && Date.now() - cachedResult.timestamp < VALIDATION_CACHE_TTL) {
      console.log(`API: Using cached ${provider} token (age: ${Math.round((Date.now() - cachedResult.timestamp) / 1000)}s)`);
      return NextResponse.json({
        provider,
        token: cachedResult.token,
        isValid: cachedResult.isValid,
        fromCache: true
      });
    }

    // First check if there's a valid token in the session for this provider
    if (provider === 'github' && (session as any).accessToken) {
      // Check if the token is still valid using GitHub API
      try {
        const isValid = await validateGithubToken((session as any).accessToken);
        if (isValid) {
          console.log('API: GitHub token from session is valid');
          
          // Store in cache
          validationCache.set(cacheKey, {
            isValid: true,
            timestamp: Date.now(),
            token: (session as any).accessToken
          });
          
          return NextResponse.json({
            provider: 'github',
            token: (session as any).accessToken,
            username: (session as any).githubUsername || null,
            isValid: true
          });
        }
      } catch (error) {
        console.log('API: GitHub token in session failed validation');
      }
    }

    if (provider === 'gitlab' && (session as any).gitlabAccessToken) {
      // Check if the token is still valid using GitLab API
      try {
        const isValid = await validateGitlabToken((session as any).gitlabAccessToken);
        if (isValid) {
          console.log('API: GitLab token from session is valid');
          
          // Store in cache
          validationCache.set(cacheKey, {
            isValid: true,
            timestamp: Date.now(),
            token: (session as any).gitlabAccessToken
          });
          
          return NextResponse.json({
            provider: 'gitlab',
            token: (session as any).gitlabAccessToken,
            username: (session as any).gitlabUsername || null,
            isValid: true
          });
        }
      } catch (error) {
        console.log('API: GitLab token in session failed validation');
      }
    }

    // If session tokens are not valid, check the database
    // First see if we have a token in the database
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_provider_tokens')
      .select('*')
      .eq('email', email)
      .eq('provider', provider)
      .single();

    if (tokenError) {
      if (tokenError.code === 'PGRST116') {
        // No token found
        return NextResponse.json(
          { error: `No ${provider} token found for user` },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: `Error fetching ${provider} token: ${tokenError.message}` },
        { status: A500 }
      );
    }

    // Check if the token is still valid based on expires_at and last validation
    const now = new Date();
    const tokenExpired = tokenData.expires_at && new Date(tokenData.expires_at) < now;
    
    // If token is marked as invalid or expired, try to refresh it
    if (!tokenData.is_valid || tokenExpired) {
      console.log(`API: ${provider} token needs refreshing (expired: ${tokenExpired}, valid: ${tokenData.is_valid})`);
      
      // Call our token refresh API
      try {
        const refreshResponse = await fetch(`${request.nextUrl.origin}/api/auth/token/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Forward the auth cookies
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify({ provider })
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          
          // Check if refresh was successful
          if (refreshData.isValid && refreshData.token) {
            console.log(`API: Successfully refreshed ${provider} token`);
            
            // Store in cache
            validationCache.set(cacheKey, {
              isValid: true,
              timestamp: Date.now(),
              token: refreshData.token
            });
            
            return NextResponse.json({
              provider,
              token: refreshData.token,
              username: refreshData.username || tokenData.username,
              isValid: true,
              refreshed: true
            });
          }
        }
        
        // If refresh failed, return the error
        console.log(`API: Failed to refresh ${provider} token`);
        return NextResponse.json(
          { error: `${provider} token is invalid and could not be refreshed` },
          { status: 401 }
        );
      } catch (refreshError) {
        console.error(`API: Error refreshing ${provider} token:`, refreshError);
        return NextResponse.json(
          { error: `Error refreshing ${provider} token` },
          { status: 500 }
        );
      }
    }
    
    // If it's a GitHub token, verify it's valid before returning (if not done recently)
    if (provider === 'github') {
      const needsValidation = !tokenData.last_validated_at || 
        (now.getTime() - new Date(tokenData.last_validated_at).getTime() > 10 * 60 * 1000); // 10 minutes
      
      if (needsValidation) {
        try {
          console.log('API: Validating GitHub token from database');
          const isValid = await validateGithubToken(tokenData.access_token);
          
          if (!isValid) {
            // Token is invalid, try to refresh it
            console.log('API: GitHub token validation failed, token is invalid');
            
            // Update token status in database
            await supabase
              .from('user_provider_tokens')
              .update({
                is_valid: false,
                last_validated_at: now.toISOString()
              })
              .eq('email', email)
              .eq('provider', 'github');
            
            return NextResponse.json(
              { error: 'GitHub token is invalid, please re-authenticate' },
              { status: 401 }
            );
          }
          
          // Token is valid, update the last_validated_at timestamp
          await supabase
            .from('user_provider_tokens')
            .update({
              is_valid: true,
              last_validated_at: now.toISOString()
            })
            .eq('email', email)
            .eq('provider', 'github');
        } catch (validationError) {
          console.error('API: Error validating GitHub token:', validationError);
          // Continue anyway since we might still have a valid token
        }
      }
    }
    
    // Similarly for GitLab
    if (provider === 'gitlab') {
      const needsValidation = !tokenData.last_validated_at || 
        (now.getTime() - new Date(tokenData.last_validated_at).getTime() > 10 * 60 * 1000); // 10 minutes
      
      if (needsValidation) {
        try {
          console.log('API: Validating GitLab token from database');
          const isValid = await validateGitlabToken(tokenData.access_token);
          
          if (!isValid) {
            // Token is invalid, try to refresh it using refresh token if available
            console.log('API: GitLab token validation failed, token is invalid');
            
            // Update token status in database
            await supabase
              .from('user_provider_tokens')
              .update({
                is_valid: false,
                last_validated_at: now.toISOString()
              })
              .eq('email', email)
              .eq('provider', 'gitlab');
            
            // If we have a refresh token, let the client know they should try refreshing
            return NextResponse.json(
              { 
                error: 'GitLab token is invalid', 
                needsRefresh: !!tokenData.refresh_token 
              },
              { status: 401 }
            );
          }
          
          // Token is valid, update the last_validated_at timestamp
          await supabase
            .from('user_provider_tokens')
            .update({
              is_valid: true,
              last_validated_at: now.toISOString()
            })
            .eq('email', email)
            .eq('provider', 'gitlab');
        } catch (validationError) {
          console.error('API: Error validating GitLab token:', validationError);
          // Continue anyway since we might still have a valid token
        }
      }
    }
    
    // Store in cache
    validationCache.set(cacheKey, {
      isValid: true,
      timestamp: Date.now(),
      token: tokenData.access_token
    });
    
    // Return the valid token
    return NextResponse.json({
      provider,
      token: tokenData.access_token,
      username: tokenData.username,
      isValid: true,
      expiresAt: tokenData.expires_at
    });
  } catch (error) {
    console.error('Error in current-token API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Helper function to validate GitHub token
async function validateGithubToken(token: string): Promise<boolean> {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`
      }
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Helper function to validate GitLab token
async function validateGitlabToken(token: string): Promise<boolean> {
  try {
    const response = await axios.get('https://gitlab.com/api/v4/user', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
} 