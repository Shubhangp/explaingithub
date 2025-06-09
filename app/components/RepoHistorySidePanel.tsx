'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { getRepoHistory, RepoHistoryItem } from '@/app/services/repoHistoryService'
import { FaGithub, FaGitlab, FaHistory, FaExternalLinkAlt } from 'react-icons/fa'
import { formatDistanceToNow } from 'date-fns'

export default function RepoHistorySidePanel() {
  const { data: session } = useSession()
  const [repoHistory, setRepoHistory] = useState<RepoHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRepoHistory() {
      setIsLoading(true)
      const history = await getRepoHistory(session?.user?.email)
      setRepoHistory(history)
      setIsLoading(false)
    }

    if (session?.user?.email) {
      fetchRepoHistory()
    } else {
      setRepoHistory([])
      setIsLoading(false)
    }
  }, [session?.user?.email])

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'github':
        return <FaGithub className="text-gray-600" />
      case 'gitlab':
        return <FaGitlab className="text-orange-500" />
      default:
        return <FaExternalLinkAlt className="text-gray-600" />
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center">
        <FaHistory className="mr-2 text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Recently Viewed</h2>
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          Loading history...
        </div>
      ) : repoHistory.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          {session?.user ? 'No repositories viewed yet' : 'Sign in to track repository history'}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {repoHistory.map((item) => (
            <li key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Link 
                href={`/${item.owner}/${item.repo}?provider=${item.provider}`}
                className="block p-4"
              >
                <div className="flex items-center mb-1">
                  {getProviderIcon(item.provider)}
                  <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                    {item.owner}/{item.repo}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Viewed {formatDistanceToNow(new Date(item.viewed_at))} ago
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
} 