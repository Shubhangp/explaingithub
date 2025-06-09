'use client'

import { useState, useEffect } from 'react'
import { FaTimes, FaBolt } from 'react-icons/fa'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function ExtensionBanner() {
  // Use state with default value true and ensure it's not affected by hydration
  const [isVisible, setIsVisible] = useState(false)
  
  // Force banner to appear after component mounts (fixes hydration issues)
  useEffect(() => {
    setIsVisible(true)
  }, [])

  if (!isVisible) return null

  return (
    <div className="w-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-950 border-b border-indigo-500/30 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between">
        <div className="flex items-center space-x-4 mb-3 sm:mb-0">
          <div className="hidden sm:flex h-10 w-10 rounded-full bg-white items-center justify-center flex-shrink-0 shadow-md shadow-indigo-700/30 p-1.5">
            <Image
              src="/logo1.svg"
              alt="ExplainGithub Logo"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <div>
            <div className="flex items-center mb-0.5">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Instantly Understand Any GitHub Repository
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 max-w-md">
              Save hours of code review time with our official browser extension for GitHub
            </p>
          </div>
        </div>
        
        <div className="flex items-center flex-shrink-0">
          <a 
            href="https://microsoftedge.microsoft.com/addons/detail/explaingithub-%E2%80%93-turn-hour/mopfjhaboemmacmpeckofbiaokhpbike" 
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 transition-all duration-150 mr-3 shadow-sm shadow-indigo-900/30"
          >
            <FaBolt className="mr-1.5 group-hover:animate-pulse text-indigo-200" />
            <span>Add to Browser</span>
            <span className="hidden sm:inline-block ml-1 text-xs bg-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-100">Free</span>
          </a>
          <button 
            onClick={() => setIsVisible(false)} 
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-700"
            aria-label="Close banner"
          >
            <FaTimes size={14} />
          </button>
        </div>
      </div>
    </div>
  )
} 