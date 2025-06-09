import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function InstallationCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleInstallationCallback = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const installationId = urlParams.get('installation_id');
        const setupAction = urlParams.get('setup_action');
        const state = urlParams.get('state');
        const savedState = localStorage.getItem('installation_state');

        console.log('Installation callback received:', {
          installationId,
          setupAction,
          state,
          savedState
        });

        // Verify state if present (for security)
        if (state && savedState && state !== savedState) {
          throw new Error('Invalid state parameter');
        }

        localStorage.removeItem('installation_state');

        if (installationId) {
          // Store installation ID
          localStorage.setItem('github_installation_id', installationId);
          
          // Check if this is an update flow
          if (setupAction === 'update') {
            console.log('Installation updated successfully');
          }
          
          // Get an OAuth token since we need it for API calls
          const authState = Math.random().toString(36).substring(7);
          localStorage.setItem('oauth_state', authState);
          
          const params = new URLSearchParams({
            client_id: process.env.REACT_APP_GITHUB_CLIENT_ID,
            redirect_uri: process.env.REACT_APP_GITHUB_REDIRECT_URI,
            scope: 'repo', // Use full repo scope since the app is installed
            state: authState
          });
          
          const authUrl = `https://github.com/login/oauth/authorize?${params}`;
          window.location.href = authUrl;
        } else {
          // If no installation ID, something went wrong
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Installation callback error:', error);
        navigate('/login?error=' + encodeURIComponent(error.message));
      }
    };

    handleInstallationCallback();
  }, [navigate, location]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Completing Installation...</h2>
        <p>Please wait while we finish setting up your GitHub App installation.</p>
      </div>
    </div>
  );
}

export default InstallationCallback; 