import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    shouldUpdateToken?: boolean
    profile?: any
    provider?: string
    githubUsername?: string
    gitlabUsername?: string
    gitlabAccessToken?: string
    gitlabRefreshToken?: string
    gitlabTokenExpiry?: number
    user?: {
      profile?: any
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    profile?: any
    provider?: string
    githubUsername?: string
    gitlabUsername?: string
    gitlabAccessToken?: string
    gitlabRefreshToken?: string
    gitlabTokenExpiry?: number
  }
} 