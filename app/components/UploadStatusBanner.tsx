'use client'

import { useState, useEffect } from 'react'
import { FaSpinner, FaCheck, FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa'

interface UploadProgress {
  [key: string]: {
    isUploading: boolean
    progress: number
    error: string | null
    completed: boolean
    message?: string
  }
}

interface UploadStatusBannerProps {
  uploadProgress: UploadProgress
  onRetryUpload?: (repoKey: string) => void
  className?: string
}

export default function UploadStatusBanner({ 
  uploadProgress, 
  onRetryUpload,
  className = ''
}: UploadStatusBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)

  // Calculate stats
  const uploadingRepos = Object.entries(uploadProgress).filter(([_, status]) => status.isUploading)
  const failedRepos = Object.entries(uploadProgress).filter(([_, status]) => status.error && !status.completed)
  const completedRepos = Object.entries(uploadProgress).filter(([_, status]) => status.completed)
  const totalActiveUploads = uploadingRepos.length + failedRepos.length

  // Show banner if there are active uploads or recent failures
  useEffect(() => {
    setShouldShow(totalActiveUploads > 0 || completedRepos.length > 0)
  }, [totalActiveUploads, completedRepos.length])

  // Auto-expand if there are uploading repos
  useEffect(() => {
    if (uploadingRepos.length > 0) {
      setIsExpanded(true)
    }
  }, [uploadingRepos.length])

  if (!shouldShow) {
    return null
  }

  const getRepoDisplayName = (repoKey: string) => {
    // Extract owner/repo from the key (format: "provider:owner/repo")
    const parts = repoKey.split(':')
    if (parts.length > 1) {
      return parts[1] // owner/repo
    }
    return repoKey
  }

  const getOverallProgress = () => {
    if (uploadingRepos.length === 0) return 100
    
    const totalProgress = uploadingRepos.reduce((sum, [_, status]) => sum + status.progress, 0)
    return Math.floor(totalProgress / uploadingRepos.length)
  }

  const getBannerColor = () => {
    if (failedRepos.length > 0) return 'bg-red-50 border-red-200 text-red-800'
    if (uploadingRepos.length > 0) return 'bg-blue-50 border-blue-200 text-blue-800'
    return 'bg-green-50 border-green-200 text-green-800'
  }

  const getStatusIcon = () => {
    if (failedRepos.length > 0) return <FaTimes className="text-red-500" />
    if (uploadingRepos.length > 0) return <FaSpinner className="animate-spin text-blue-500" />
    return <FaCheck className="text-green-500" />
  }

  const getStatusMessage = () => {
    if (uploadingRepos.length > 0) {
      return `Uploading ${uploadingRepos.length} ${uploadingRepos.length === 1 ? 'repository' : 'repositories'}...`
    }
    if (failedRepos.length > 0) {
      return `${failedRepos.length} ${failedRepos.length === 1 ? 'upload' : 'uploads'} failed`
    }
    if (completedRepos.length > 0) {
      return `${completedRepos.length} ${completedRepos.length === 1 ? 'repository' : 'repositories'} uploaded successfully`
    }
    return 'All uploads completed'
  }

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md ${className}`}>
      <div className={`rounded-lg border-2 p-4 shadow-lg transition-all duration-300 ${getBannerColor()}`}>
        {/* Header */}
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <div className="font-medium text-sm">
                {getStatusMessage()}
              </div>
              {uploadingRepos.length > 0 && (
                <div className="text-xs opacity-75">
                  {getOverallProgress()}% complete
                </div>
              )}
            </div>
          </div>
          
          <button className="ml-2 p-1 hover:bg-black hover:bg-opacity-10 rounded">
            {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
          </button>
        </div>

        {/* Overall progress bar */}
        {uploadingRepos.length > 0 && (
          <div className="mt-3">
            <div className="w-full bg-white bg-opacity-50 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${getOverallProgress()}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Detailed status */}
        {isExpanded && totalActiveUploads > 0 && (
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
            {/* Uploading repositories */}
            {uploadingRepos.map(([repoKey, status]) => (
              <div key={repoKey} className="bg-white bg-opacity-30 rounded p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate flex-1">
                    {getRepoDisplayName(repoKey)}
                  </span>
                  <span className="text-blue-600 ml-2">
                    {status.progress}%
                  </span>
                </div>
                <div className="mt-1">
                  <div className="w-full bg-white bg-opacity-50 rounded-full h-1">
                    <div 
                      className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${status.progress}%` }}
                    ></div>
                  </div>
                </div>
                {status.message && (
                  <div className="text-xs opacity-75 mt-1 truncate">
                    {status.message}
                  </div>
                )}
              </div>
            ))}

            {/* Failed repositories */}
            {failedRepos.map(([repoKey, status]) => (
              <div key={repoKey} className="bg-white bg-opacity-30 rounded p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate flex-1">
                    {getRepoDisplayName(repoKey)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <FaTimes className="text-red-500" size={10} />
                    {onRetryUpload && (
                      <button
                        onClick={() => onRetryUpload(repoKey)}
                        className="text-red-600 hover:text-red-800 underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
                {status.error && (
                  <div className="text-xs text-red-600 mt-1 truncate">
                    {status.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Dismiss button for completed uploads */}
        {uploadingRepos.length === 0 && failedRepos.length === 0 && completedRepos.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setShouldShow(false)}
              className="text-xs px-3 py-1 bg-white bg-opacity-30 rounded hover:bg-opacity-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}