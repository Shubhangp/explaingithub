export function invalidateToken(provider: ProviderType): void {
  if (typeof window !== 'undefined') {
    // Clear the token from the cache
    try {
      const cachedData = localStorage.getItem('provider_tokens_cache')
      if (cachedData) {
        const tokenCache = JSON.parse(cachedData)
        if (tokenCache && tokenCache[provider]) {
          // Remove the provider token from the cache
          delete tokenCache[provider]
          localStorage.setItem('provider_tokens_cache', JSON.stringify(tokenCache))
          console.log(`${provider} token invalidated in cache`)
        }
      }
      
      // Also clear from session storage if present
      if (provider === 'github') {
        sessionStorage.removeItem('github_token')
      } else if (provider === 'gitlab') {
        sessionStorage.removeItem('gitlab_token')
      }
      
      // Clear any in-memory token from the next-auth session
      if (typeof window !== 'undefined' && window.__NEXT_AUTH && window.__NEXT_AUTH.session) {
        try {
          // Attempt to clear the token from the next-auth session if it exists
          const session = window.__NEXT_AUTH.session
          if (session && session.user && session.user[`${provider}Token`]) {
            delete session.user[`${provider}Token`]
          }
        } catch (e) {
          console.error(`Error clearing ${provider} token from session:`, e)
        }
      }
    } catch (e) {
      console.error(`Error invalidating ${provider} token:`, e)
    }
  }
} 