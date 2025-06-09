'use client'

import { useSession } from 'next-auth/react'

export default function TalkPage() {
  const { data: session } = useSession()

  if (!session) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto">
          <p>Please sign in to use the Talk feature.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Talk with AI about Repositories</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Select a repository from the "All Repos" tab or enter a repository path to start exploring and chatting.
        </p>
      </div>
    </div>
  )
} 