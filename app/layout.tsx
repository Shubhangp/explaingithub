import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '../components/Navbar'
import Footer from './components/Footer'
import { Providers } from './providers'
import GoogleAnalytics from './components/GoogleAnalytics'
import TokenUpdater from './components/TokenUpdater'
import EmailVerifier from './components/EmailVerifier'
import ChatLogger from './components/ChatLogger'
import ExtensionBanner from './components/ExtensionBanner'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true
})

export const metadata: Metadata = {
  title: 'GitHub Directory Viewer',
  description: 'View and manage GitHub repositories with ease',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <GoogleAnalytics />
      </head>
      <body className={`${inter.className} antialiased min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col`}>
        <Providers>
          <TokenUpdater />
          <EmailVerifier />
          <ExtensionBanner />
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow">
            {children}
          </main>
          <Footer />
          <ChatLogger />
        </Providers>
      </body>
    </html>
  )
} 