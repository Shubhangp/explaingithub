'use client'

import { useEffect } from 'react'
import Script from 'next/script'

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            We Value Your Feedback
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Help us improve ExplainGithub by sharing your thoughts and suggestions
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden mx-auto">
          <div className="flex justify-center items-center p-6">
            <div 
              className="w-full"
              style={{
                maxWidth: '800px',
                height: '600px',
                margin: '0 auto'
              }}
              data-fillout-id="of1cUSZY5kus" 
              data-fillout-embed-type="fullscreen" 
              data-fillout-inherit-parameters 
              data-fillout-dynamic-resize
            />
          </div>
          <Script 
            src="https://server.fillout.com/embed/v1/" 
            strategy="afterInteractive"
          />
        </div>
      </div>
    </div>
  )
} 