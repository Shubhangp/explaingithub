'use client'

import { useState, useEffect } from 'react'
import { FaFolder, FaFile, FaChevronLeft } from 'react-icons/fa'
import Link from 'next/link'

interface FileItem {
  name: string
  type: 'file' | 'dir'
  path: string
  sha: string
}

export default function RepositoryPage({ params }: { params: { name: string } }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(`/api/repositories/${params.name}/contents${currentPath}`)
        if (!response.ok) throw new Error('Failed to fetch repository contents')
        const data = await response.json()
        setFiles(data)
      } catch (err) {
        setError('Failed to load repository contents. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchFiles()
  }, [params.name, currentPath])

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  const navigateToPath = (path: string) => {
    setCurrentPath(path)
  }

  const goBack = () => {
    const newPath = currentPath.split('/').slice(0, -1).join('/')
    setCurrentPath(newPath)
  }

  return (
    <div className="min-h-[80vh]">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/repositories" className="text-blue-500 hover:text-blue-700">
          <FaChevronLeft className="inline mr-2" />
          Back to Repositories
        </Link>
        <h1 className="text-3xl font-bold">{params.name}</h1>
      </div>

      {currentPath && (
        <button
          onClick={goBack}
          className="mb-4 text-blue-500 hover:text-blue-700 flex items-center gap-2"
        >
          <FaChevronLeft />
          Back
        </button>
      )}

      <div className="bg-white rounded-lg shadow-md">
        {files.map((file) => (
          <div
            key={file.path}
            className="border-b last:border-b-0 p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => file.type === 'dir' && navigateToPath(file.path)}
          >
            <div className="flex items-center gap-3">
              {file.type === 'dir' ? (
                <FaFolder className="text-blue-500" />
              ) : (
                <FaFile className="text-gray-500" />
              )}
              <span>{file.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 