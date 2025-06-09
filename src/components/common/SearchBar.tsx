'use client'

import { useState } from 'react'

interface SearchBarProps {
  onSearch: (owner: string, repo: string) => void
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (owner && repo) {
      onSearch(owner, repo)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-4 mb-8">
      <input
        type="text"
        placeholder="Owner"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="flex-1 p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
      />
      <input
        type="text"
        placeholder="Repository"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        className="flex-1 p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-github-blue text-white rounded hover:bg-blue-600"
      >
        Search
      </button>
    </form>
  )
} 