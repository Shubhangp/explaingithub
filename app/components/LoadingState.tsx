'use client'

import React from 'react'

interface LoadingStateProps {
  message?: string
  className?: string
}

export default function LoadingState({ 
  message = 'Loading...', 
  className = '' 
}: LoadingStateProps) {
  return (
    <div className={`min-h-[50vh] flex items-center justify-center ${className}`}>
      <div className="space-y-4 text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-500 dark:text-gray-400">{message}</p>
      </div>
    </div>
  )
} 