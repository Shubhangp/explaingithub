'use client'

import { useState, useEffect } from 'react'
import { FaGitlab, FaSave } from 'react-icons/fa'

interface GitLabSettingsFormProps {
  onSaved?: () => void;
}

export default function GitLabSettingsForm({ onSaved }: GitLabSettingsFormProps) {
  const [gitlabToken, setGitlabToken] = useState('')
  const [gitlabInstanceUrl, setGitlabInstanceUrl] = useState('https://gitlab.com')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  
  useEffect(() => {
    // Load saved values
    try {
      const savedToken = localStorage.getItem('gitlabToken')
      const savedUrl = localStorage.getItem('gitlabInstanceUrl')
      
      if (savedToken) {
        setGitlabToken(savedToken)
      }
      
      if (savedUrl) {
        setGitlabInstanceUrl(savedUrl)
      }
    } catch (error) {
      console.error('Error loading GitLab settings:', error)
    }
  }, [])
  
  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage('')
    
    try {
      // Validate URL format
      if (gitlabInstanceUrl && !gitlabInstanceUrl.startsWith('http')) {
        throw new Error('GitLab instance URL must start with http:// or https://')
      }
      
      // Trim trailing slashes from URL
      const formattedUrl = gitlabInstanceUrl.replace(/\/+$/, '')
      
      // Save to localStorage
      if (gitlabToken) {
        localStorage.setItem('gitlabToken', gitlabToken)
      }
      
      localStorage.setItem('gitlabInstanceUrl', formattedUrl)
      
      // Additionally save to API if available
      try {
        const response = await fetch('/api/user/update-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            provider: 'gitlab',
            token: gitlabToken,
            instanceUrl: formattedUrl
          })
        })
        
        if (response.ok) {
          console.log('GitLab settings saved to API')
        }
      } catch (apiError) {
        console.error('Error saving to API:', apiError)
        // Continue with localStorage only
      }
      
      setSaveMessage('GitLab settings saved successfully!')
      
      if (onSaved) {
        onSaved()
      }
      
      // Force reload providers
      window.dispatchEvent(new CustomEvent('provider-settings-updated'))
    } catch (error) {
      console.error('Error saving GitLab settings:', error)
      setSaveMessage(`Error: ${error.message || 'Failed to save settings'}`)
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
      <div className="flex items-center gap-2 mb-4">
        <FaGitlab className="text-orange-600 text-xl" />
        <h2 className="text-lg font-semibold">GitLab Settings</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="gitlabToken" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Personal Access Token
          </label>
          <input
            id="gitlabToken"
            type="password"
            value={gitlabToken}
            onChange={(e) => setGitlabToken(e.target.value)}
            placeholder="glpat-xxxxxxxxxxxxx"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Create a token with api scope at GitLab &gt; Settings &gt; Access Tokens
          </p>
        </div>
        
        <div>
          <label htmlFor="gitlabInstanceUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            GitLab Instance URL
          </label>
          <input
            id="gitlabInstanceUrl"
            type="text"
            value={gitlabInstanceUrl}
            onChange={(e) => setGitlabInstanceUrl(e.target.value)}
            placeholder="https://gitlab.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            For self-hosted GitLab, enter your instance URL (e.g., https://gitlab.example.com)
          </p>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <FaSave className="mr-2" /> Save Settings
              </>
            )}
          </button>
        </div>
        
        {saveMessage && (
          <div className={`mt-3 text-sm ${saveMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  )
} 