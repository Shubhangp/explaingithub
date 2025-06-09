'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { FaSearch, FaCode, FaRocket, FaLightbulb } from 'react-icons/fa'

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const urlPattern = /github\.com\/([^\/]+)\/([^\/\s]+)/
      const match = url.match(urlPattern)

      if (!match) {
        setError('Please enter a valid GitHub repository URL')
        return
      }

      const [, owner, repo] = match
      router.push(`/${owner}/${repo}`)
    } catch (err) {
      setError('Invalid GitHub repository URL')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-4xl w-full space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Explore GitHub with Style
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            A modern way to browse and understand GitHub repositories.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="glass p-2 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <FaSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter GitHub repository URL"
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                           focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-4 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90"
              >
                Explore
              </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-500">
                {error}
              </p>
            )}
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <FeatureCard
            icon={<FaCode />}
            title="Smart Code Navigation"
            description="Browse repository code with an intuitive interface"
          />
          <FeatureCard
            icon={<FaRocket />}
            title="Lightning Fast"
            description="Instant access to any GitHub repository"
          />
          <FeatureCard
            icon={<FaLightbulb />}
            title="Modern Experience"
            description="Clean and responsive design for better readability"
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="text-2xl text-primary mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  )
} 