'use client'

import { useEffect } from 'react'

export default function IssuesPage() {
  useEffect(() => {
    // Load Fillout script
    const script = document.createElement('script')
    script.src = 'https://server.fillout.com/embed/v1/'
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Clean up
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">Report an Issue</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-center">
            Please use the form below to report any issues or provide feedback. We appreciate your help!
          </p>
          
          <div 
            style={{width:"100%", height:"500px"}} 
            data-fillout-id="t9D2YGDDt2us" 
            data-fillout-embed-type="standard" 
            data-fillout-inherit-parameters 
            data-fillout-dynamic-resize
          />
        </div>
      </div>
    </div>
  )
} 