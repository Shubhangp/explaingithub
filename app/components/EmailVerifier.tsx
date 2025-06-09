'use client'

import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function EmailVerifier() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  
  useEffect(() => {
    const verifyEmail = async () => {
      // Only run this check if we're authenticated
      if (status === 'authenticated' && session?.user?.email) {
        try {
          // Check if we have a stored email to verify against
          const userEnteredEmail = localStorage.getItem('userEnteredEmail')
          
          if (userEnteredEmail) {
            console.log('Verifying email match:', userEnteredEmail, 'vs', session.user.email)
            
            // Compare the emails (case insensitive)
            if (userEnteredEmail.toLowerCase() !== session.user.email.toLowerCase()) {
              console.error('Email mismatch detected, signing out')
              
              // Store the mismatch details for display
              localStorage.setItem('emailMismatch', JSON.stringify({
                entered: userEnteredEmail,
                github: session.user.email
              }))
              
              // Clear the entered email to avoid a loop
              localStorage.removeItem('userEnteredEmail')
              
              // Sign out and redirect to login page
              await signOut({ redirect: false })
              
              // Force reload to the login page with error parameter
              window.location.href = '/login?error=email_mismatch'
              return
            }
            
            // Emails match, clear the verification data
            console.log('Email verified successfully')
            localStorage.removeItem('userEnteredEmail')
          }
        } catch (error) {
          console.error('Error during email verification:', error)
        } finally {
          setIsChecking(false)
        }
      } else if (status !== 'loading') {
        setIsChecking(false)
      }
    }
    
    verifyEmail()
  }, [session, status, router])
  
  // This component doesn't render anything, it just performs the check
  return null
} 