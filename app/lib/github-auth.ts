import { Octokit } from 'octokit';
import supabase from './supabase';

/**
 * Gets a GitHub access token for a user from Supabase
 * 
 * @param email The user's email address
 * @returns The access token or null if not found
 */
export async function getAccessTokenFromStorage(email: string): Promise<string | null> {
  try {
    if (!email) {
      console.error('Missing email parameter');
      return null;
    }

    console.log('Fetching access token for:', email);
    
    // Query Supabase for the access token
    const { data, error } = await supabase
      .from('user_tokens')
      .select('access_token')
      .eq('email', email)
      .single();
    
    if (error) {
      console.error('Error retrieving access token from Supabase:', error);
      return null;
    }
    
    if (!data) {
      console.log('No access token found for user:', email);
      return null;
    }
    
    return data.access_token;
  } catch (error) {
    console.error('Error retrieving access token:', error);
    return null;
  }
}

/**
 * Gets GitHub user information using an access token
 * 
 * @param accessToken The GitHub access token
 * @returns User information or null if there was an error
 */
export async function getGitHubUserInfo(accessToken: string) {
  try {
    const octokit = new Octokit({ auth: accessToken });
    
    // Get basic user information
    const { data: user } = await octokit.rest.users.getAuthenticated();
    
    // Get emails if the primary email is not available
    let email = user.email;
    if (!email) {
      try {
        const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
        email = emails.find(e => e.primary)?.email || emails[0]?.email;
      } catch (error) {
        console.error('Error retrieving user emails:', error);
      }
    }
    
    return {
      id: user.id,
      login: user.login,
      name: user.name || user.login,
      email,
      avatar_url: user.avatar_url,
    };
  } catch (error) {
    console.error('Error retrieving GitHub user info:', error);
    return null;
  }
}

/**
 * Authenticates a user with GitHub using their stored access token
 * 
 * @param email The user's email address
 * @returns User information or null if authentication failed
 */
export async function authenticateWithGitHub(email: string) {
  try {
    // Get the access token from Supabase
    const accessToken = await getAccessTokenFromStorage(email);
    
    if (!accessToken) {
      console.error('No access token found for user:', email);
      return null;
    }
    
    // Get GitHub user information
    return await getGitHubUserInfo(accessToken);
  } catch (error) {
    console.error('Error authenticating with GitHub:', error);
    return null;
  }
} 