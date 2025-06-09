'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { FaGithub, FaFolder, FaCode, FaLock, FaSearch, FaRocket, FaStar, FaCodeBranch, FaLightbulb } from 'react-icons/fa'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const featuredRepos = [
  {
    owner: 'ollama',
    repo: 'ollama',
    description: 'Get up and running with Llama 3.3, DeepSeek-R1, Phi-4, Gemma 2, and other large language models.',
    stars: '130k',
    language: 'Go',
    languageColor: '#00ADD8',
    isPrivate: false
  },
  {
    owner: 'open-webui',
    repo: 'open-webui',
    description: 'User-friendly AI Interface (Supports Ollama, OpenAI API, ...)',
    stars: '79.5k', 
    language: 'JavaScript',
    languageColor: '#f1e05a',
    isPrivate: false
  },
  {
    owner: 'searxng',
    repo: 'searxng',
    description: 'SearXNG is a free internet metasearch engine which aggregates results from various search services and databases. Users are neither tracked nor profiled.',
    stars: '16.8k',
    language: 'Python',
    languageColor: '#3572A5',
    isPrivate: false
  }
]

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all"
  >
    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-gray-600 dark:text-gray-400">{description}</p>
  </motion.div>
)

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const repoUrl = new URL(url)
      const [, owner, repo] = repoUrl.pathname.split('/')
      if (owner && repo) {
        router.push(`/${owner}/${repo}`)
      } else {
        setError('Invalid repository URL')
      }
    } catch {
      setError('Please enter a valid GitHub repository URL')
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-6xl mx-auto w-full space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
              Explore GitHub with Style
            </h1>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
              A modern way to browse and understand GitHub repositories
            </p>
          </motion.div>

          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="glass p-2 rounded-2xl shadow-lg">
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
                  className="px-6 py-4 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all"
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
        </div>

        {/* Sample Repositories Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-8"
        >
          <h2 className="text-3xl font-bold text-center">
            Try These Popular Repositories
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredRepos.map((repo) => (
              <Link
                key={`${repo.owner}/${repo.repo}`}
                href={`/${repo.owner}/${repo.repo}`}
                className="block p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <FaGithub className="text-2xl" />
                  <h3 className="font-semibold text-lg">
                    {repo.owner}/{repo.repo}
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {repo.description}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <FaStar className="text-yellow-400" />
                    {repo.stars}
                  </span>
                  <span className="ml-auto">
                    {repo.language}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* Tutorial Video Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="space-y-8"
        >
          <div className="max-w-3xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl shadow-lg" style={{ paddingTop: '56.25%' }}>
              <iframe 
                src="https://www.youtube.com/embed/99IAGHemPDw"
                title="Explaingithub : Turn hours of code reading into minutes of understanding."
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full"
              ></iframe>
            </div>
            <p className="text-center mt-4 text-gray-600 dark:text-gray-400">
              This tutorial demonstrates how ExplainGithub simplifies code comprehension and navigation
            </p>
          </div>
        </motion.section>

        {/* Features Section */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-center">
            Powerful Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<FaCode className="text-2xl text-primary" />}
              title="Smart Code Navigation"
              description="Browse repository code with an intuitive interface and powerful search capabilities"
            />
            <FeatureCard
              icon={<FaRocket className="text-2xl text-primary" />}
              title="Lightning Fast"
              description="Experience instant access to any GitHub repository with optimized performance"
            />
            <FeatureCard
              icon={<FaLightbulb className="text-2xl text-primary" />}
              title="Modern Experience"
              description="Enjoy a clean and responsive design that makes code exploration a breeze"
            />
          </div>
        </section>
      </div>
    </div>
  )
} 