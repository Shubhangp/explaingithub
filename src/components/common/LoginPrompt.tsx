'use client'

import { signIn } from 'next-auth/react'
import { FaGithub, FaLock } from 'react-icons/fa'

export default function LoginPrompt() {
  return (
    <div className="p-8 border rounded-lg dark:border-gray-700 text-center">
      <div className="flex flex-col items-center gap-4">
        <FaLock className="text-4xl text-gray-400" />
        <h2 className="text-xl font-semibold">Private Repository</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          You need to sign in with GitHub to view this repository
        </p>
        <button
          onClick={() => signIn('github')}
          className="flex items-center gap-2 px-4 py-2 bg-github-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <FaGithub className="text-xl" />
          <span>Sign in with GitHub</span>
        </button>
      </div>
    </div>
  )
} 