import type { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import GitlabProvider from 'next-auth/providers/gitlab'
import { Provider } from 'next-auth/providers/index'

// Configure authentication options
export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
      authorization: {
        params: {
          scope: 'read:user user:email repo'
        }
      }
    }) as Provider,
    GitlabProvider({
      clientId: process.env.GITLAB_CLIENT_ID || '',
      clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
    }) as Provider,
  ],
  
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token and provider to the token
      if (account) {
        token.accessToken = account.access_token
        token.provider = account.provider
        token.profile = profile
        
        // Store provider-specific usernames
        if (account.provider === 'github' && profile) {
          token.githubUsername = (profile as any).login
        } else if (account.provider === 'gitlab' && profile) {
          token.gitlabUsername = (profile as any).username
          token.gitlabAccessToken = account.access_token
        }
      }
      return token
    },
    
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string
      session.provider = token.provider as string
      
      // Add provider-specific data
      if (token.provider === 'github') {
        session.githubUsername = token.githubUsername as string
      } else if (token.provider === 'gitlab') {
        session.gitlabUsername = token.gitlabUsername as string
        session.gitlabAccessToken = token.gitlabAccessToken as string
      }
      
      return session
    }
  },
  
  session: {
    strategy: 'jwt',
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
} 