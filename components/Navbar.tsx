'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { FaChevronDown, FaSearch, FaBars, FaTimes } from 'react-icons/fa'
import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import ThemeToggle from '../app/components/ThemeToggle'
import { useDirectSignIn } from '@/app/hooks/useDirectSignIn'
import SignInModal from '@/app/components/SignInModal'
import { AnimatePresence, motion } from 'framer-motion'
import GitHubSignInButton from '@/app/components/GitHubSignInButton'

export default function Navbar() {
  const { data: session, status } = useSession()
  const [url, setUrl] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter()
  const pathname = usePathname()
  const [searchUrl, setSearchUrl] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const {
    handleSignIn,
    isModalOpen,
    closeModal,
    handlePreSignIn
  } = useDirectSignIn()

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/
      const matches = url.match(urlPattern)

      if (matches && matches[1] && matches[2]) {
        const [, owner, repo] = matches
        router.push(`/${owner}/${repo}`)
        setUrl('')
      }
    } catch (error) {
      console.error('Invalid GitHub URL:', error)
    }
  }

  const isActive = (path: string) => pathname === path

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Mobile Layout - Hamburger and Logo (visible only on small screens) */}
          <div className="flex items-center gap-3 sm:hidden">
            {/* Mobile Menu Button */}
            <button
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <FaTimes className="block h-4 w-4" aria-hidden="true" />
              ) : (
                <FaBars className="block h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Logo for Mobile */}
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo1.svg"
                alt="Logo"
                width={60}
                height={60}
                className="dark:invert"
              />
            </Link>
          </div>

          {/* Desktop Layout - Logo and Navigation (visible only on larger screens) */}
          <div className="hidden sm:flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo1.svg"
                alt="Logo"
                width={60}
                height={60}
                className="dark:invert"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className={`px-3 py-2 text-sm rounded-md transition-colors ${isActive('/')
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
              >
                Home
              </Link>
              <Link
                href="/repositories"
                className={`px-3 py-2 text-sm rounded-md transition-colors ${isActive('/repositories')
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
              >
                Repositories
              </Link>
            </div>
          </div>

          {/* Center section - Search (visible only on larger screens) */}
          <div className="hidden sm:flex flex-1 max-w-2xl px-4">
            <form onSubmit={handleUrlSubmit} className="w-full">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <FaSearch className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter GitHub repository URL"
                  spellCheck="false"
                  suppressHydrationWarning={true}
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-full
                           border border-gray-200 dark:border-gray-700
                           bg-gray-50 dark:bg-gray-800
                           text-gray-900 dark:text-gray-100
                           placeholder-gray-500 dark:placeholder-gray-400
                           focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                           transition-colors"
                />
              </div>
            </form>
          </div>

          {/* Right section - Auth (different for mobile and desktop) */}
          <div className="flex items-center gap-4">
            {/* Desktop Only - Theme toggle and Issue button */}
            <div className="hidden sm:flex items-center gap-4">
              <ThemeToggle />
              <Link
                href="/issues"
                className="px-3 py-2 text-sm font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Report an Issue ⚠️
              </Link>
            </div>

            {/* Auth Section - Adapts for both mobile and desktop */}
            {session ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 focus:outline-none"
                >                  
                  {session.user?.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700"
                    />
                  )}
                  <FaChevronDown className="text-gray-500 dark:text-gray-300 text-xs" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 z-50">
                    <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 font-medium border-b dark:border-gray-700">
                      {(session as any)?.githubUsername || 
                 (session as any)?.gitlabUsername || 
                 'No username available'}
                    </div>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        router.push('/profile');
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <GitHubSignInButton
                buttonText="Sign in"
                iconSize={16}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                         bg-primary dark:bg-gray-100 text-black dark:text-gray-900 
                         hover:opacity-90 dark:hover:opacity-90
                         transition-all duration-200 shadow-sm hover:shadow"
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden absolute top-16 inset-x-0 z-50 shadow-lg border-t border-gray-200 dark:border-gray-800"
          >
            <div className="bg-white dark:bg-gray-900 p-4 space-y-3">
              {/* Mobile Search */}
              <div className="mb-2">
                <form onSubmit={handleUrlSubmit} className="w-full">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <FaSearch className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Enter GitHub repository URL"
                      spellCheck="false"
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-lg
                               border border-gray-200 dark:border-gray-700
                               bg-gray-50 dark:bg-gray-800
                               text-gray-900 dark:text-gray-100
                               placeholder-gray-500 dark:placeholder-gray-400
                               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                               transition-colors"
                    />
                    <button
                      type="submit"
                      className="absolute inset-y-0 right-2 flex items-center p-2 text-primary"
                    >
                      Search
                    </button>
                  </div>
                </form>
              </div>

              {/* Theme Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/70">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Toggle Theme
                </span>
                <ThemeToggle />
              </div>

              {/* Mobile Navigation Links */}
              <div className="space-y-2">
                <Link
                  href="/"
                  className={`block px-3 py-2 text-base rounded-md transition-colors ${isActive('/')
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                >
                  Home
                </Link>
                <Link
                  href="/repositories"
                  className={`block px-3 py-2 text-base rounded-md transition-colors ${isActive('/repositories')
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                >
                  Repositories
                </Link>
                <Link
                  href="/issues"
                  className="block px-3 py-2 text-base rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Report an Issue ⚠️
                </Link>
              </div>

              {/* User Profile & Authentication - Only shown if user is logged in */}
              {session && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 px-4 py-3">
                    {session.user?.image && (
                      <img
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-700"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {session.user?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {session.user?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="w-full mt-2 text-left px-4 py-3 text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign In Modal */}
      <SignInModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onPreSignInSubmit={handlePreSignIn}
      />
    </nav>
  )
}