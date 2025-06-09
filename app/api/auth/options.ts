import GithubProvider from 'next-auth/providers/github'
import GitLabProvider from 'next-auth/providers/gitlab'
import { headers, cookies } from 'next/headers'
import { saveUserLoginInfo, saveUserProviderToken } from '@/app/lib/supabase-utils'
import type { NextAuthOptions } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import type { Session } from 'next-auth'
import { saveToSpreadsheet } from "@/app/utils/spreadsheet"
import supabase from "@/app/lib/supabase"

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
    GitLabProvider({
      clientId: process.env.GITLAB_CLIENT_ID || '',
      clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'read_user read_api read_repository',
        },
      },
    }),
    // Temporarily removed due to import issues
    // AzureADProvider({
    //   clientId: process.env.AZURE_CLIENT_ID || '',
    //   clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    //   tenantId: process.env.AZURE_TENANT_ID || '',
    // }),
    // BitbucketProvider({
    //   clientId: process.env.BITBUCKET_CLIENT_ID || '',
    //   clientSecret: process.env.BITBUCKET_CLIENT_SECRET || '',
    // }),
  ],
  pages: {
    signIn: '/login',
    error: '/login', // Add custom error page
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      try {
        // Get IP address from headers
        const forwardedFor = headers().get('x-forwarded-for');
        const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'Unknown';
        
        // Check for email verification cookie that would have been set before GitHub auth
        const cookieStore = cookies();
        const expectedEmail = cookieStore.get('expected_github_email')?.value;
        
        if (expectedEmail && expectedEmail !== user.email?.toLowerCase()) {
          // Return false to prevent sign in
          return `/login?error=email_mismatch&expected=${encodeURIComponent(expectedEmail)}&actual=${encodeURIComponent(user.email || '')}`;
        }
        
        // 1. Save to Login Info sheet (removed User Logins)
        if (user.email) {
          await saveUserLoginInfo({
            email: user.email,
            ipAddress,
          });
        }
        
        // 2. Save the provider token in the database with enhanced information
        if (user.email && account) {
          const username = account.provider === 'github' 
            ? (profile as any)?.login
            : (profile as any)?.username;
            
          // Calculate token expiry if available in the response
          let expiresAt = null;
          if (account.expires_at) {
            // Convert seconds to milliseconds and create a Date object
            expiresAt = new Date(account.expires_at * 1000).toISOString();
          } else if (account.provider === 'gitlab') {
            // GitLab tokens typically expire in 2 hours, add as default
            const twoHoursFromNow = new Date();
            twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);
            expiresAt = twoHoursFromNow.toISOString();
          }
          
          // Save extensive token information
          await supabase
            .from('user_provider_tokens')
            .upsert({
            email: user.email,
            provider: account.provider,
              access_token: account.access_token || '',
              refresh_token: account.refresh_token || null,
              token_type: account.token_type || 'Bearer',
              expires_at: expiresAt,
            username: username || '',
              user_id: (profile as any)?.id?.toString() || '',
              is_valid: true,
              last_validated_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'email,provider'
            });
            
          console.log(`Stored ${account.provider} token with${account.refresh_token ? '' : 'out'} refresh token`);
        }
        
        // 3. Save to Sheet1 with user details
        await saveToSpreadsheet({
          name: user.name || "",
          email: user.email || "",
          organization: (profile as any)?.company || "",
          purpose: `${account?.provider?.toUpperCase() || 'GitHub'} Login`,
          username: (profile as any)?.login || (profile as any)?.username || "", // Handle both GitHub and GitLab usernames
        });
        
        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return true; // Don't block sign-in due to error
      }
    },
    async jwt({ token, account, profile, trigger, session, user }) {
      // IMPORTANT: Don't overwrite existing tokens when connecting a new provider
      if (account) {
        // Store the current provider that's being authenticated
        token.currentProvider = account.provider;
        
        // Store provider-specific information in the token
        if (account.provider === 'github') {
          // Store GitHub specific tokens without clearing other providers
          token.githubAccessToken = account.access_token;
          token.githubUsername = (profile as any)?.login;
          
          // Keep track of GitHub being connected
          token.githubConnected = true;
        } 
        else if (account.provider === 'gitlab') {
          // Store GitLab-specific token info
          token.gitlabAccessToken = account.access_token;
          token.gitlabRefreshToken = account.refresh_token;
          token.gitlabTokenExpiry = account.expires_at;
          token.gitlabUsername = (profile as any)?.username;
          
          // Keep track of GitLab being connected
          token.gitlabConnected = true;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token.currentProvider) {
        // Store the current/primary provider
        session.provider = token.currentProvider;
      }
      
      // Add provider-specific data for ALL connected providers
      // GitHub data
      if (token.githubConnected) {
        session.githubConnected = true;
        session.githubUsername = token.githubUsername;
        session.githubAccessToken = token.githubAccessToken;
      }
      
      // GitLab data
      if (token.gitlabConnected) {
        session.gitlabConnected = true;
        session.gitlabUsername = token.gitlabUsername;
        session.gitlabAccessToken = token.gitlabAccessToken;
      }
      
      // The main accessToken is from the current provider
      if (token.currentProvider === 'github' && token.githubAccessToken) {
        session.accessToken = token.githubAccessToken;
      } else if (token.currentProvider === 'gitlab' && token.gitlabAccessToken) {
        session.accessToken = token.gitlabAccessToken;
      }
      
      return session;
    }
  },
} 