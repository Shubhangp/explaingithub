'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import GitHubLoginButton from '../components/GitHubLoginButton'
import GitLabSignInButton from '../components/GitLabSignInButton'
import { useSession } from 'next-auth/react'
import { useEffect, Suspense } from 'react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const { status } = useSession()

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      router.push(callbackUrl)
    }
  }, [status, router, callbackUrl])

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-gray-600 mt-2">
            Sign in with GitHub or GitLab to continue
          </p>
        </div>

        <div className="space-y-6">
          {/* GitHub login button */}
          <GitHubLoginButton 
            callbackUrl={callbackUrl} 
            className="w-full"
          />
          
          {/* GitLab login button */}
          <GitLabSignInButton
            callbackUrl={callbackUrl}
            className="w-full"
          />
          
          <p className="text-sm text-gray-500 text-center mt-4">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
} 