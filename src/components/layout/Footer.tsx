'use client'

import Link from 'next/link'
import { FaLinkedin, FaEnvelope } from 'react-icons/fa'

export default function Footer() {
  return (
    <footer className="py-6 border-t">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ExplainGithub. All rights reserved.
          </p>
          <div className="flex items-center space-x-4">
            <a
              href="https://github.com/yourusername/github-directory-viewer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
} 