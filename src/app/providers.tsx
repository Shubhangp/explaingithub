'use client'

import { ThemeProvider } from '@/src/components/common/ThemeProvider'
import AuthProvider from '@/src/components/common/AuthProvider'
import Header from "@/src/components/layout/Header"
import Footer from "@/src/components/layout/Footer"

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Header />
        <main className="min-h-screen pt-16">
          {children}
        </main>
        <Footer />
      </ThemeProvider>
    </AuthProvider>
  )
} 