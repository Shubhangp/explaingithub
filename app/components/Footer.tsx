import Link from 'next/link'
import Image from 'next/image'
import { FaLinkedin, FaEnvelope } from 'react-icons/fa'

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo1.svg"
                alt="Logo"
                width={70}
                height={70}
                className="dark:invert"
              />
           
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A modern way to explore and understand GitHub repositories with AI-powered insights
            </p>
          </div>

          {/* About Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">About</h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>A part of PWM Group</p>
              <p>Committed to digital innovation<br />and public service transformation</p>
              <Link 
                href="/feedback"
                className="inline-flex items-center px-6 py-3 mt-4 text-base font-semibold bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 hover:scale-105 hover:shadow-xl transform transition-all duration-200 animate-pulse"
              >
                Give Feedback
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Contact Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Contact</h3>
            <div className="flex space-x-4">
              <Link
                href="https://www.linkedin.com/in/shivam--maurya"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
              >
                <FaLinkedin className="w-6 h-6" />
                <span className="sr-only">LinkedIn</span>
              </Link>
              <Link
                href="mailto:shivam.maurya@programmingwithmaurya.com"
                className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
              >
                <FaEnvelope className="w-6 h-6" />
                <span className="sr-only">Email</span>
              </Link>
            </div>
            <div className="mt-4">
              <a 
                href="https://www.producthunt.com/posts/explaingithub?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-explaingithub" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <img 
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=925367&theme=light&t=1740758807558" 
                  alt="ExplainGithub - Turn hours of code reading into minutes of understanding | Product Hunt" 
                  style={{ width: '250px', height: '54px' }} 
                  width="250" 
                  height="54" 
                />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} PWM Group. All rights reserved.
            </p>
            <div className="mt-4 sm:mt-0 flex space-x-6">
              <Link 
                href="/privacy" 
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
} 