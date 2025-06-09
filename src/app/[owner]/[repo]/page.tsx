'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import DirectoryViewer from '@/src/components/DirectoryViewer'
import FileViewer from '@/src/components/FileViewer'
import ChatBox from '@/src/components/ChatBox'
import { FaGithub } from 'react-icons/fa'

export default function RepoPage({ params }: { params: { owner: string; repo: string } }) {
  const { data: session, status } = useSession()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const provider = (searchParams.get('provider') || 'github') as 'github' | 'gitlab'

  useEffect(() => {
    console.log('Page params:', params)
    console.log('Session status:', status)
    console.log('Session data:', session)
  }, [params, status, session])

  // Handle loading state
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-blue-200"></div>
      </div>
    )
  }

  // We no longer block unauthenticated users from viewing the repository
  // The ChatBox component will handle its own authentication

  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4 text-red-500">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Repository Info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{params.owner}/{params.repo}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Directory Structure */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-[600px] overflow-y-auto">
          <DirectoryViewer 
            owner={params.owner} 
            repo={params.repo}
            provider={provider}
            onFileSelect={setSelectedFile}
          />
        </div>

        {/* Right Column: Chat Box */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 h-[600px]">
          <ChatBox 
            owner={params.owner} 
            repo={params.repo}
            provider={provider}
            selectedFile={selectedFile}
          />
        </div>
      </div>

      {/* Bottom Section: File Viewer */}
      <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 min-h-[400px]">
        <FileViewer 
          owner={params.owner} 
          repo={params.repo}
          filePath={selectedFile}
        />
      </div>
    </div>
  )
} 