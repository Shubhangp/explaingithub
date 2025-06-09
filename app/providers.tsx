'use client'

import { ThemeProvider } from 'next-themes'
import { SessionProvider } from 'next-auth/react'
import EmailVerifier from './components/EmailVerifier'
import { ProviderContextProvider } from './context/ProviderContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem={true}
      themes={['light', 'dark', 'system']}
      disableTransitionOnChange
    >
      <SessionProvider>
        <ProviderContextProvider>
          <EmailVerifier />
          {children}
        </ProviderContextProvider>
      </SessionProvider>
    </ThemeProvider>
  )
} 