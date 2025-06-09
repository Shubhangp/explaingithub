'use client'

import Link from 'next/link'
import { useSession, signIn, signOut } from 'next-auth/react'

export default function Navigation() {
  const { data: session } = useSession()

  return (
    <nav className="bg-github-gray p-4">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex gap-4">
          <Link 
            href="/" 
            className="text-white hover:text-github-blue"
          >
            Home
          </Link>
          <Link 
            href="/about" 
            className="text-white hover:text-github-blue"
          >
            About
          </Link>
        </div>
        <div>
          {session ? (
            <div className="flex items-center gap-4">
              <span className="text-white">
                {session.user?.name}
              </span>
              <button
                onClick={() => signOut()}
                className="text-white hover:text-github-blue"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('github')}
              className="text-white hover:text-github-blue"
            >
              Sign in with GitHub
            </button>
          )}
        </div>
      </div>
    </nav>
  )
} 