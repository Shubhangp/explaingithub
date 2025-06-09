'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Octokit } from '@octokit/rest'
import { FaBook, FaStar, FaCodeBranch, FaCircle } from 'react-icons/fa'

interface Repository {
  id: number
  name: string
  full_name: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  private: boolean
  updated_at: string | null
}

export default function ReposPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (session?.accessToken) {
      fetchRepos()
    }
  }, [session])

  const fetchRepos = async () => {
    try {
      const octokit = new Octokit({
        auth: session?.accessToken,
      })

      const { data } = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      })

      setRepos(data)
    } catch (error) {
      console.error('Error fetching repos:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRepos = repos.filter(repo =>
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (repo.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500">Loading repositories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 pb-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Your Repositories Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Your Repositories</h2>
          <div className="space-y-6">
            {/* Search Your Repos */}
            <div>
              <input
                type="text"
                placeholder="Search your repositories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-md px-4 py-3 rounded-xl border border-gray-200 
                         focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              />
            </div>

            {/* Repository Grid */}
            <div className="grid gap-4">
              {filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => router.push(`/${repo.full_name}`)}
                  className="text-left p-6 bg-white border border-gray-200 rounded-xl 
                           hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-grow min-w-0">
                      <div className="flex items-center gap-2">
                        <FaBook className="text-gray-400" />
                        <h3 className="font-semibold truncate">{repo.full_name}</h3>
                        {repo.private && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 rounded-full">
                            Private
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-gray-600 text-sm line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {repo.language && (
                          <div className="flex items-center gap-1">
                            <FaCircle className="text-[0.6rem]" />
                            <span>{repo.language}</span>
                          </div>
                        )}
                        {repo.stargazers_count > 0 && (
                          <div className="flex items-center gap-1">
                            <FaStar />
                            <span>{repo.stargazers_count}</span>
                          </div>
                        )}
                        {repo.forks_count > 0 && (
                          <div className="flex items-center gap-1">
                            <FaCodeBranch />
                            <span>{repo.forks_count}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <time className="text-sm text-gray-500 whitespace-nowrap">
                      Updated {new Date(repo.updated_at || '').toLocaleDateString()}
                    </time>
                  </div>
                </button>
              ))}

              {filteredRepos.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  {searchTerm ? (
                    <p>No repositories found matching "{searchTerm}"</p>
                  ) : (
                    <p>No repositories found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 