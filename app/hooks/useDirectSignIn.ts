import { useCallback, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export const useDirectSignIn = (callbackUrl = '/') => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const handleSignIn = useCallback(() => {
    if (status === 'authenticated') {
      // If user is already authenticated, redirect them directly
      router.push(callbackUrl);
    } else {
      // Open the modal to let the user choose if they're new or existing
      setIsModalOpen(true);
    }
  }, [status, router, callbackUrl]);

  const handlePreSignIn = async (userData: {
    name: string;
    email: string;
    organization: string;
    purpose: string;
  }) => {
    try {
      // Save user data to Sheet1
      const response = await fetch('/api/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to save user data');
      }

      // Get client IP address
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const ipAddress = ipData.ip;

        // Save login info to the Login Info sheet
        await fetch('/api/log-login-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            ipAddress,
          }),
        });
      } catch (error) {
        console.error('Error logging IP information:', error);
        // Continue with sign-in even if this fails
      }

      // Proceed with GitHub sign in
      signIn('github', { callbackUrl });
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return {
    handleSignIn,
    isModalOpen,
    closeModal,
    handlePreSignIn,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    session
  };
}; 