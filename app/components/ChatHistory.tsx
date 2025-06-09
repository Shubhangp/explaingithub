'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { getUserConversations, ConversationMetadata } from '@/app/lib/chat-persistence'
import { FaHistory, FaTrash, FaGithub, FaGitlab } from 'react-icons/fa'
import { formatDistanceToNow } from 'date-fns'

interface ChatHistoryProps {
  onConversationSelect?: (conversation: ConversationMetadata) => void
  currentRepo?: { owner: string; repo: string }
}

export default function ChatHistory({ onConversationSelect, currentRepo }: ChatHistoryProps) {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<ConversationMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadConversations() {
      try {
        setIsLoading(true)
        setError(null)
        
        const userEmail = session?.user?.email
        const userConversations = await getUserConversations(userEmail)
        
        setConversations(userConversations)
      } catch (err) {
        console.error('Error loading conversations:', err)
        setError('Failed to load conversation history')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadConversations()
  }, [session])
  
  // Re-fetch conversations periodically to ensure they're up-to-date
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const userEmail = session?.user?.email
        const userConversations = await getUserConversations(userEmail)
        setConversations(userConversations)
      } catch (err) {
        console.error('Error refreshing conversations:', err)
      }
    }, 5 * 60 * 1000) // Refresh every 5 minutes
    
    return () => clearInterval(intervalId)
  }, [session])
  
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'github':
        return <FaGithub className="text-gray-600 dark:text-gray-400" />
      case 'gitlab':
        return <FaGitlab className="text-orange-500" />
      default:
        return <FaHistory className="text-gray-600 dark:text-gray-400" />
    }
  }
  
  // Identify the current conversation
  const isCurrentConversation = (item: ConversationMetadata) => {
    return currentRepo && 
      item.owner === currentRepo.owner && 
      item.repo === currentRepo.repo
  }
  
  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Loading chat history...
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    )
  }
  
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        {session?.user ? 'No chat history yet' : 'Sign in to view chat history'}
      </div>
    )
  }
  
  return (
    <div className="bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center">
        <FaHistory className="mr-2 text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">Chat History</h2>
      </div>
      
      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {conversations.map((conversation) => (
          <li 
            key={conversation.id}
            className={`
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
              ${isCurrentConversation(conversation) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
            `}
          >
            <Link 
              href={`/${conversation.owner}/${conversation.repo}?provider=${conversation.provider}`}
              className="block p-4"
            >
              <div className="flex items-center mb-1">
                {getProviderIcon(conversation.provider)}
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {conversation.owner}/{conversation.repo}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-1 line-clamp-2">
                {conversation.previewText}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                <span>
                  {conversation.messageCount} message{conversation.messageCount !== 1 ? 's' : ''}
                </span>
                <span>
                  {formatDistanceToNow(new Date(conversation.lastUpdated))} ago
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
} 