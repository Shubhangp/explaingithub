'use client'

import { useState } from 'react'
import RepositoryCard from './RepositoryCard'
import { FaGithub, FaGitlab } from 'react-icons/fa'
import { SiAzuredevops, SiBitbucket } from 'react-icons/si'

type Repository = {
  id: string
  name: string
  fullName: string
  description: string | null
  url: string
  owner: {
    login: string
    avatarUrl?: string
  }
  stargazersCount?: number
  forksCount?: number
  watchersCount?: number
  provider: 'github' | 'gitlab' | 'azure' | 'bitbucket'
}

interface RepositoryListProps {
  repositories: Repository[]
  isLoading?: boolean
}

export default function RepositoryList({ repositories, isLoading = false }: RepositoryListProps) {
  const [filter, setFilter] = useState<string>('all')

  const filteredRepositories = filter === 'all' 
    ? repositories 
    : repositories.filter(repo => repo.provider === filter)

  if (isLoading) {
    return (
      <div className="w-full py-12">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
        <p className="text-center mt-4 text-gray-600">Loading repositories...</p>
      </div>
    )
  }

  if (repositories.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6 text-center">
        <p className="text-gray-500 mb-4">No repositories found</p>
        <p className="text-sm text-gray-400">
          Connect to a provider in settings to view your repositories
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap justify-center md:justify-start gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            filter === 'all'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('github')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
            filter === 'github'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FaGithub className="mr-2" /> GitHub
        </button>
        <button
          onClick={() => setFilter('gitlab')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
            filter === 'gitlab'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FaGitlab className="mr-2" /> GitLab
        </button>
        <button
          onClick={() => setFilter('azure')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
            filter === 'azure'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <SiAzuredevops className="mr-2" /> Azure
        </button>
        <button
          onClick={() => setFilter('bitbucket')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
            filter === 'bitbucket'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <SiBitbucket className="mr-2" /> Bitbucket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRepositories.map((repository) => (
          <RepositoryCard key={`${repository.provider}-${repository.id}`} repository={repository} />
        ))}
      </div>
      
      {filteredRepositories.length === 0 && (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">No repositories found for this provider</p>
        </div>
      )}
    </div>
  )
} 