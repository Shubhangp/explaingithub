interface TokenData {
  email: string;
  name: string;
  expiresAt: string;
  createdAt: string;
  accessToken?: string;
}

/**
 * Store user authentication token in localStorage
 */
export function storeUserToken(userData: { 
  email: string; 
  name: string;
  organization?: string;
}) {
  try {
    // Create expiration date (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    // Create token data object
    const tokenData: TokenData = {
      email: userData.email,
      name: userData.name,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    };
    
    // Store in localStorage
    localStorage.setItem(`auth-token-${userData.email}`, JSON.stringify(tokenData));
    
    return true;
  } catch (error) {
    console.error('Error storing user token:', error);
    return false;
  }
}

/**
 * Retrieve and validate user token
 */
export function validateUserToken(email: string): { 
  valid: boolean; 
  userData?: Omit<TokenData, 'expiresAt' | 'createdAt'>;
} {
  try {
    // Get token from localStorage
    const tokenString = localStorage.getItem(`auth-token-${email}`);
    
    if (!tokenString) {
      return { valid: false };
    }
    
    // Parse token data
    const tokenData: TokenData = JSON.parse(tokenString);
    
    // Check if token is expired
    const expirationDate = new Date(tokenData.expiresAt);
    if (expirationDate < new Date()) {
      // Token is expired
      localStorage.removeItem(`auth-token-${email}`);
      return { valid: false };
    }
    
    // Token is valid
    return { 
      valid: true,
      userData: {
        email: tokenData.email,
        name: tokenData.name
      }
    };
  } catch (error) {
    console.error('Error validating user token:', error);
    return { valid: false };
  }
}

/**
 * Remove user token from localStorage
 */
export function removeUserToken(email: string): boolean {
  try {
    localStorage.removeItem(`auth-token-${email}`);
    return true;
  } catch (error) {
    console.error('Error removing user token:', error);
    return false;
  }
}

/**
 * Updates an existing user token with the GitHub access token
 */
export function updateTokenWithAccessToken(email: string, accessToken: string): boolean {
  try {
    // Get existing token
    const tokenString = localStorage.getItem(`auth-token-${email}`);
    
    if (!tokenString) {
      // If no token exists, create a new one with minimal information
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const tokenData: TokenData = {
        email: email,
        name: email.split('@')[0], // Use part of email as name if none exists
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        accessToken: accessToken
      };
      
      localStorage.setItem(`auth-token-${email}`, JSON.stringify(tokenData));
      return true;
    }
    
    // Update existing token
    const tokenData: TokenData = JSON.parse(tokenString);
    
    // Update the token with the access token and refresh expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const updatedTokenData: TokenData = {
      ...tokenData,
      expiresAt: expiresAt.toISOString(),
      accessToken: accessToken
    };
    
    localStorage.setItem(`auth-token-${email}`, JSON.stringify(updatedTokenData));
    return true;
  } catch (error) {
    console.error('Error updating token with access token:', error);
    return false;
  }
} 