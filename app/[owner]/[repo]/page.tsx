// app/[owner]/[repo]/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import RepoViewer from '@/app/components/RepoViewer'
import { uploadRepositoryContents, checkRepositoryUploadStatus, getUploadStatus } from '@/app/lib/repository-upload'
import LoadingState from '@/app/components/LoadingState'

export default function RepoPage({ params }: { params: { owner: string; repo: string } }) {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const provider = searchParams.get('provider') || 'github'
  
  const [uploadStatus, setUploadStatus] = useState<{
    checking: boolean
    uploading: boolean
    uploaded: boolean
    error: string | null
    progress: number
  }>({
    checking: true,
    uploading: false,
    uploaded: false,
    error: null,
    progress: 0
  })

  useEffect(() => {
    const checkAndUpload = async () => {
      try {
        // First check if repository is already uploaded
        setUploadStatus(prev => ({ ...prev, checking: true }))
        
        const status = await checkRepositoryUploadStatus(params.owner, params.repo, provider)
        
        if (status.uploaded) {
          console.log(`Repository ${params.owner}/${params.repo} is already uploaded`)
          setUploadStatus({
            checking: false,
            uploading: false,
            uploaded: true,
            error: null,
            progress: 100
          })
          return
        }

        // Repository not uploaded, start automatic upload
        console.log(`Repository ${params.owner}/${params.repo} not uploaded, starting automatic upload...`)
        
        setUploadStatus({
          checking: false,
          uploading: true,
          uploaded: false,
          error: null,
          progress: 0
        })

        // Get access token from session
        const accessToken = session?.accessToken || (session as any)?.gitlabAccessToken
        
        if (!accessToken && status === 'authenticated') {
          throw new Error('No access token available for repository upload')
        }

        // For public repos accessed without authentication, try to upload anyway
        const result = await uploadRepositoryContents(
          params.owner,
          params.repo,
          provider,
          accessToken,
          (progress) => {
            setUploadStatus(prev => ({ ...prev, progress }))
          },
          (message) => {
            console.log('Upload message:', message)
          }
        )

        if (result.success) {
          setUploadStatus({
            checking: false,
            uploading: false,
            uploaded: true,
            error: null,
            progress: 100
          })
        } else {
          setUploadStatus({
            checking: false,
            uploading: false,
            uploaded: false,
            error: result.error || 'Failed to upload repository',
            progress: 0
          })
        }
      } catch (error: any) {
        console.error('Error in checkAndUpload:', error)
        setUploadStatus({
          checking: false,
          uploading: false,
          uploaded: false,
          error: error.message || 'Failed to check/upload repository',
          progress: 0
        })
      }
    }

    // Only run the check/upload when we have the necessary data
    if (params.owner && params.repo && status !== 'loading') {
      checkAndUpload()
    }
  }, [params.owner, params.repo, provider, session, status])

  // Show loading state while checking or uploading
  if (uploadStatus.checking || uploadStatus.uploading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingState 
            message={
              uploadStatus.checking 
                ? "Checking repository status..." 
                : `Uploading repository... ${uploadStatus.progress}%`
            } 
          />
          {uploadStatus.uploading && (
            <div className="w-64 mx-auto">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadStatus.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show error state if upload failed
  if (uploadStatus.error && !uploadStatus.uploaded) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-xl">⚠️ Upload Failed</div>
          <p className="text-gray-600 dark:text-gray-400">{uploadStatus.error}</p>
          <p className="text-sm text-gray-500">
            You can still browse and chat about the repository, but some features may be limited.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Repository is uploaded or we're proceeding anyway, show the viewer
  return (
    <div className="h-screen">
      <div className="w-full">
        <RepoViewer 
          owner={params.owner} 
          repo={params.repo} 
          provider={provider as 'github' | 'gitlab'} 
        />
      </div>
    </div>
  )
}