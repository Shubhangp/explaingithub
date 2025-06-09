const handleGitHubLogin = async () => {
  try {
    const response = await fetch('/api/auth/init-oauth', {
      method: 'POST',
      credentials: 'include'
    });
    const { state } = await response.json();
    
    sessionStorage.setItem('oauth_state', state);
    
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_CALLBACK_URL}&state=${state}&scope=repo`;
  } catch (error) {
    console.error('Login initiation failed:', error);
  }
}; 