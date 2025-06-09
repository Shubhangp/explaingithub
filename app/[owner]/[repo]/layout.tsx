'use client'

import { useEffect } from 'react'
import { ensureDatabaseSetup } from '@/app/supabase-api/setup-db'

export default function RepoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize database on client side load
  useEffect(() => {
    // Use setTimeout to ensure it runs after initial render
    const timer = setTimeout(() => {
      ensureDatabaseSetup()
        .then(() => console.log('Database setup initialized'))
        .catch(err => console.error('Database setup failed:', err))
    }, 3000)
    
    return () => clearTimeout(timer)
  }, [])
  
  return <>{children}</>
} 