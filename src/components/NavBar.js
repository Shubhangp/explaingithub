'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const NavBar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const session = await response.json()
        setIsLoggedIn(!!session?.user)
      } catch (error) {
        console.error('Failed to check authentication status:', error)
        setIsLoggedIn(false)
      }
    }

    checkAuth()
  }, [])

  return (
    <nav className="bg-gray-800 text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo1.svg" alt="Logo" width={32} height={32} />
          
          </Link>
          <div className="flex space-x-4">
            <Link href="/" className="hover:text-gray-300">
              Home
            </Link>
            <Link href="/repositories" className="hover:text-gray-300">
              Repositories
            </Link>
            {isLoggedIn ? (
              <Link href="/api/auth/signout" className="hover:text-gray-300">
                Logout
              </Link>
            ) : (
              <Link href="/login" className="hover:text-gray-300">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default NavBar 