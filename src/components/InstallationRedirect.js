import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function InstallationRedirect() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleInstallationComplete = () => {
      // Try to extract installation ID from referrer URL
      const urlMatch = /installations\/(\d+)/.exec(document.referrer);
      const installationId = urlMatch ? urlMatch[1] : '';
      
      if (installationId) {
        console.log(`Detected installation ID: ${installationId} from GitHub`);
        localStorage.setItem('github_installation_id', installationId);
      }
      
      // Try to use the app's client ID for direct authorization  
      const appClientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
      if (!appClientId) {
        console.error('GitHub client ID not configured');
        navigate('/login?error=missing_client_id');
        return;
      }
      
      // Create a direct OAuth URL to skip the installation step
      const state = Math.random().toString(36).substring(7);
      localStorage.setItem('oauth_state', state);
      
      const params = new URLSearchParams({
        client_id: appClientId,
        redirect_uri: process.env.REACT_APP_GITHUB_REDIRECT_URI,
        scope: 'repo', // Full repo scope for installed app
        state: state
      });
      
      console.log('Redirecting to GitHub OAuth directly...');
      window.location.href = `https://github.com/login/oauth/authorize?${params}`;
    };
    
    handleInstallationComplete();
  }, [navigate]);
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Installation Complete!</h2>
        <p>Redirecting you to login...</p>
      </div>
    </div>
  );
}

export default InstallationRedirect; 