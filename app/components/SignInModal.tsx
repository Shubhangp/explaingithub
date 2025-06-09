'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaGithub, FaLock, FaEnvelope } from 'react-icons/fa';
import { signIn, signOut } from 'next-auth/react';
import PreSignInForm from './PreSignInForm';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { validateUserToken, storeUserToken } from '../utils/tokenHelper';
import { BiErrorCircle } from 'react-icons/bi';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreSignInSubmit: (userData: {
    name: string;
    email: string;
    organization: string;
    purpose: string;
  }) => void;
}

export default function SignInModal({ isOpen, onClose, onPreSignInSubmit }: SignInModalProps) {
  const [userType, setUserType] = useState<'new' | 'existing' | null>(null);
  const [showPreSignInForm, setShowPreSignInForm] = useState(false);
  const [showEmailCheckForm, setShowEmailCheckForm] = useState(true);
  const [showUserNotFoundOptions, setShowUserNotFoundOptions] = useState(false);
  const [notFoundEmail, setNotFoundEmail] = useState('');
  const [email, setEmail] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [showEmailMismatchSignOut, setShowEmailMismatchSignOut] = useState(false);
  const [mismatchDetails, setMismatchDetails] = useState<{enteredEmail: string, githubEmail: string} | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  
  const [githubAccountEmail, setGithubAccountEmail] = useState<string | null>(null);
  
  // Create a wrapper for onClose that clears any stored email
  const handleClose = () => {
    // Clear any stored email to prevent lingering verification issues
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userEnteredEmail');
    }
    
    // Call the original onClose handler
    onClose();
  };
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setUserType(null);
      setShowPreSignInForm(false);
      setShowEmailCheckForm(true);
      setShowUserNotFoundOptions(false);
      setEmailError('');
      
      // Reset email input field
      if (emailInputRef.current) {
        emailInputRef.current.value = '';
      }
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (!mounted) return;
    
    if (isOpen) {
      if (!overlayRef.current) {
        const overlay = document.createElement('div');
        overlay.id = 'blur-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backdropFilter = 'blur(8px)';
        overlay.style['WebkitBackdropFilter' as any] = 'blur(8px)';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.zIndex = '40';
        overlay.style.pointerEvents = 'none';
        
        document.body.appendChild(overlay);
        overlayRef.current = overlay;
      }
    } else {
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
    }
    
    return () => {
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showEmailCheckForm) {
        e.stopPropagation();
      }
    };

    if (mounted && showEmailCheckForm) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [mounted, showEmailCheckForm]);

  const checkIfGitHubAuthorized = async () => {
    try {
      setIsCheckingUser(true);
      
      const hasToken = localStorage.getItem('github-authorized') === 'true';
      
      if (hasToken) {
        return true;
      }

      const response = await fetch('/api/check-github-authorized');
      const data = await response.json();
      
      if (data.authorized) {
        localStorage.setItem('github-authorized', 'true');
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    } finally {
      setIsCheckingUser(false);
    }
  };

  const checkIfEmailExists = async (email: string) => {
    try {
      setIsCheckingEmail(true);
      setEmailError('');
      
      const response = await fetch('/api/check-email-exists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        console.error(`Server returned status ${response.status} with text: ${await response.text()}`);
        throw new Error(`Failed to check email (status ${response.status})`);
      }
      
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('Error in checkIfEmailExists:', error);
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const checkGitHubAccountEmail = async () => {
    try {
      const isLikelyAuthenticated = typeof window !== 'undefined' && (
        localStorage.getItem('github-authorized') === 'true' || 
        sessionStorage.getItem('github-authenticated') === 'true' ||
        document.cookie.includes('next-auth.session-token') ||
        document.cookie.includes('__Secure-next-auth.session-token') ||
        document.cookie.includes('next-auth.callback-url') ||
        document.cookie.includes('_gh_sess') ||
        document.cookie.includes('user_session')
      );
      
      const response = await fetch('/api/get-github-email', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        return { isLoggedIn: false, email: null };
      }
      
      const data = await response.json();
      return { 
        isLoggedIn: !!data.email, 
        email: data.email || null
      };
    } catch (error) {
      return { isLoggedIn: false, email: null };
    }
  };

  const handleNewUserSelection = () => {
    setUserType('new');
    setShowPreSignInForm(true);
    setShowEmailCheckForm(false);
  };

  const handleExistingUserSelection = async () => {
    try {
      // For direct GitHub sign-in, we'll need to update the token after successful authentication
      // This would ideally be done in a callback after GitHub auth succeeds
      
      // For now, set the auth flags
      localStorage.setItem('github-authorized', 'true');
      sessionStorage.setItem('github-authenticated', 'true');
      
      // Redirect to GitHub OAuth
      signIn('github', { 
        callbackUrl: '/',
        // We could add a parameter to indicate we need to update the token
        // This would be handled in the callback route
      });
      
      // Close the modal
      handleClose();
    } catch (error) {
      console.error('Error during existing user sign-in:', error);
      // Fallback to email verification if direct sign-in fails
      setUserType('existing');
      setShowPreSignInForm(false);
      setShowEmailCheckForm(true);
    }
  };

  const handleSignOutFromGitHub = async () => {
    try {
      // Clear local authentication flags
      localStorage.removeItem('github-authorized');
      sessionStorage.removeItem('github-authenticated');
      
      // Sign out via NextAuth
      await signOut({ redirect: false });
      
      // Clear error message
      setEmailError('');
      setShowEmailMismatchSignOut(false);
      setMismatchDetails(null);
      console.log('Successfully signed out from GitHub');
      
      // Give feedback to the user
      setEmailError('Successfully signed out. Please try again with the correct GitHub account.');
      
      // Refresh the page after a short delay to complete the sign-out process
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error signing out:', error);
      setEmailError('Error signing out. Please try refreshing the page.');
    }
  };

  const handleEmailSubmit = async (email: string) => {
    setIsCheckingEmail(true);
    setShowEmailMismatchSignOut(false);
    setMismatchDetails(null);
    try {
      // Always store the entered email for post-authentication verification
      if (typeof window !== 'undefined') {
        localStorage.setItem('userEnteredEmail', email);
        
        // Also set a cookie with the expected email for server-side verification
        try {
          const response = await fetch('/api/set-expected-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          });
          
          if (!response.ok) {
            console.error('Failed to set expected email cookie:', await response.text());
          }
        } catch (error) {
          console.error('Error setting expected email cookie:', error);
        }
      }
      
      // First, check if we have a valid token for this email
      if (typeof window !== 'undefined') {
        const tokenValidation = validateUserToken(email);
        
        if (tokenValidation.valid && tokenValidation.userData) {
          console.log('Valid token found for user:', tokenValidation.userData.email);
          // Set user as authenticated using the stored token
          localStorage.setItem('github-authorized', 'true');
          sessionStorage.setItem('github-authenticated', 'true');
          
          // Close the modal and bypass GitHub auth
          handleClose();
          setIsCheckingEmail(false);
          return;
        }
      }
      
      // Check if the user is already logged into GitHub and verify email match
      const githubEmailCheck = await checkGitHubAccountEmail();
      if (githubEmailCheck.isLoggedIn && githubEmailCheck.email) {
        // Compare emails (case insensitive)
        if (email.toLowerCase() !== githubEmailCheck.email.toLowerCase()) {
          setEmailError(
            `The email you entered (${email}) doesn't match the email associated with your GitHub account (${githubEmailCheck.email}). Please sign out of GitHub and sign in with the account that uses ${email}.`
          );
          setShowEmailMismatchSignOut(true);
          setMismatchDetails({
            enteredEmail: email,
            githubEmail: githubEmailCheck.email
          });
          setIsCheckingEmail(false);
          return;
        }
      }
      
      // No valid token, proceed with normal flow
      // Check if email exists in spreadsheet
      try {
        const response = await fetch('/api/check-email-exists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        
        if (data.exists) {
          // Email exists, user is existing
          console.log('Email exists, proceeding to GitHub sign-in');
          setUserType('existing');
          // Proceed to GitHub sign-in directly
          signIn('github', { callbackUrl: '/' });
          localStorage.setItem('github-authorized', 'true');
          sessionStorage.setItem('github-authenticated', 'true');
          handleClose();
        } else {
          // Email doesn't exist, user is new
          console.log('Email not found, proceeding to registration form');
          setUserType('new');
          setEmail(email);
          setShowEmailCheckForm(false);
          setShowPreSignInForm(true);
        }
      } catch (fetchError) {
        console.error('Error in API call:', fetchError);
        // Type check fetchError before accessing message property
        if (fetchError instanceof Error) {
          setEmailError(`API error: ${fetchError.message}`);
        } else {
          setEmailError('An unexpected error occurred');
        }
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setEmailError('Failed to check email. Please try again.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleSignIn = async () => {
    setUserType(null);
  };

  const handlePreSignInSubmit = async (userData: {
    name: string;
    email: string;
    organization: string;
    purpose: string;
  }) => {
    try {
      // Save the user data first
      await onPreSignInSubmit(userData);
      
      // Store token information in localStorage with expiration
      storeUserToken(userData);
      
      // Mark this browser as having authorized GitHub
      localStorage.setItem('github-authorized', 'true');
      sessionStorage.setItem('github-authenticated', 'true');
      
      // After submitting form, proceed to GitHub sign in
      signIn('github', { callbackUrl: '/' });
      
      handleClose();
    } catch (error) {
      console.error('Error during sign-in submission:', error);
      // Display an error message to the user
      setEmailError('There was a problem signing in. Please try again.');
    }
  };

  const EmailCheckForm = () => {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          Enter your email address
        </h2>
        
        <form onSubmit={handleEmailFormSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email address
            </label>
            <input
              ref={emailInputRef}
              type="email"
              id="email"
              name="email"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            {emailError && (
              <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
                <BiErrorCircle className="inline-block mr-1" />
                {emailError}
              </div>
            )}
            
            {showEmailMismatchSignOut && mismatchDetails && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleSignOutFromGitHub}
                  className="px-4 py-2 w-full text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
                >
                  <FaGithub className="mr-2" />
                  Sign out from GitHub
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  After signing out, please refresh the page and try again with the correct GitHub account.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none"
              disabled={isCheckingEmail}
            >
              {isCheckingEmail ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const UserNotFoundOptions = () => {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          You are not registered
        </h2>
        
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-amber-700 dark:text-amber-300">
            The email <span className="font-bold">{notFoundEmail}</span> is not registered in our system.
          </p>
        </div>
        
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          Would you like to:
        </p>
        
        <div className="space-y-4">
          <button
            onClick={() => {
              setUserType('new');
              setShowPreSignInForm(true);
              setShowUserNotFoundOptions(false);
            }}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Register as a new user
          </button>
          
          <button
            onClick={() => {
              setShowEmailCheckForm(true);
              setShowUserNotFoundOptions(false);
              setEmailError('');
              if (emailInputRef.current) {
                emailInputRef.current.value = '';
              }
            }}
            className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-colors"
          >
            Try again with a different email
          </button>
        </div>
      </div>
    );
  };

  const ModalPortal = () => {
    if (!mounted) return null;
    
    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-hidden"
            style={{ pointerEvents: 'none' }}
          >
            <div 
              className="absolute inset-0" 
              onClick={onClose}
              style={{ pointerEvents: 'auto' }}
            />
            
            <div className="fixed inset-0 flex items-start justify-center">
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-2xl mx-4
                          border border-gray-200 dark:border-gray-700 z-50 mt-32"
                style={{ 
                  maxHeight: '90vh', 
                  overflowY: 'auto',
                  pointerEvents: 'auto',
                  isolation: 'isolate'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                
                {isCheckingUser ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 border-4 border-t-transparent border-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Checking account...</p>
                  </div>
                ) : showEmailCheckForm ? (
                  <EmailCheckForm />
                ) : showUserNotFoundOptions ? (
                  <UserNotFoundOptions />
                ) : showPreSignInForm ? (
                  <PreSignInForm
                    onSubmit={handlePreSignInSubmit}
                    initialEmail={email}
                    onCancel={() => {
                      setShowPreSignInForm(false);
                      setShowEmailCheckForm(true);
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <div className="flex justify-center mb-6">
                      <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-full 
                                    flex items-center justify-center">
                        <FaGithub className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
                      Sign In to Continue
                    </h2>
                    
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                      Use your GitHub account to continue
                    </p>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSignIn}
                      className="w-full flex items-center justify-center gap-3 p-4 bg-gray-900 dark:bg-gray-100
                               text-white dark:text-gray-900 rounded-xl font-medium
                               hover:bg-gray-800 dark:hover:bg-white transition-colors"
                    >
                      <FaGithub className="h-5 w-5" />
                      <span>Sign in with GitHub</span>
                    </motion.button>

                    <div className="mt-6 text-center">
                      <Link 
                        href="/privacy" 
                        className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                      >
                        <FaLock className="h-3 w-3 mr-1" />
                        <span>How we handle your GitHub data</span>
                      </Link>
                    </div>

                    {emailError && (
                      <p className="mt-2 p-2 text-sm text-red-600 dark:text-red-400 whitespace-pre-line border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/30 rounded-md">
                        {emailError}
                        {emailError === 'User not found. Would you like to:' && (
                          <div className="mt-3 flex flex-col gap-2">
                            <button 
                              onClick={() => {
                                setUserType('new');
                                setShowPreSignInForm(true);
                                setShowEmailCheckForm(false);
                              }}
                              className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                            >
                              Register as a new user
                            </button>
                            <button 
                              onClick={() => {
                                setEmailError('');
                                if (emailInputRef.current) {
                                  emailInputRef.current.value = '';
                                }
                              }}
                              className="px-3 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              Try again with a different email
                            </button>
                          </div>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );
  };

  // Add useEffect to detect and set GitHub authentication status on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for authentication indicators
      const hasNextAuthSession = 
        document.cookie.includes('next-auth.session-token') ||
        document.cookie.includes('__Secure-next-auth.session-token');
      
      const hasGitHubSession =
        document.cookie.includes('_gh_sess') ||
        document.cookie.includes('user_session');
      
      // If we detect any authentication, set our markers
      if (hasNextAuthSession || hasGitHubSession) {
        sessionStorage.setItem('github-authenticated', 'true');
        localStorage.setItem('github-authorized', 'true');
      }
    }
  }, []);

  const handleEmailFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValue = emailInputRef.current?.value || '';
      
    if (!emailValue.trim()) {
      setEmailError('Email is required');
      return;
    }
    
    // Clear any previous errors
    setEmailError('');
    
    // Call the handleEmailSubmit function with the email value
    await handleEmailSubmit(emailValue);
  };

  return <ModalPortal />;
} 