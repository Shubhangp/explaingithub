import NextAuth, { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import { headers } from 'next/headers'
import { saveUserLoginInfo } from '@/src/lib/google-sheets'

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization: {
        params: {
          scope: 'read:user repo',
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token
        token.profile = profile
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.accessToken = token.accessToken
        // @ts-ignore - Adding profile to session
        session.profile = token.profile
      }
      return session
    },
    async signIn({ user }) {
      try {
        console.log('NextAuth signIn callback triggered for user:', user.email);
        
        // Get IP address from headers
        const forwardedFor = headers().get('x-forwarded-for');
        const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'Unknown';
        console.log('Got IP address from headers:', ipAddress);

        // Call original logging API endpoint
        try {
          console.log('Calling log-login API endpoint');
          const response = await fetch(`${process.env.NEXTAUTH_URL}/api/log-login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email || 'unknown',
              name: user.name || 'unknown',
              ipAddress,
            }),
          });

          if (!response.ok) {
            console.error('Failed to log user login');
          } else {
            console.log('Successfully logged user login to User Logins sheet');
          }
        } catch (logLoginError) {
          console.error('Error logging user login to User Logins sheet:', logLoginError);
        }
        
        // Also save to the Login Info sheet
        try {
          console.log('Calling saveUserLoginInfo to save to Login Info sheet');
          const result = await saveUserLoginInfo({
            email: user.email || 'unknown',
            ipAddress,
          });
          
          if (result.success) {
            console.log('Successfully saved login info to Login Info sheet');
          } else {
            console.error('Failed to save login info to Login Info sheet:', result.error);
          }
        } catch (saveLoginInfoError) {
          console.error('Error saving to Login Info sheet:', saveLoginInfoError);
        }
      } catch (error) {
        // Log error but don't prevent sign in
        console.error('Error in NextAuth signIn callback:', error);
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST } 