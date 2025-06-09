import supabase from '@/app/lib/supabase';

export interface RepoHistoryItem {
  id: number;
  provider: string;
  owner: string;
  repo: string;
  viewed_at: string;
}

/**
 * Adds a repository to the user's view history
 * Updates the timestamp if the repo already exists in history
 */
export async function addRepoToHistory(email: string | null | undefined, provider: string, owner: string, repo: string) {
  if (!email) {
    // Don't track history for non-logged in users
    return;
  }

  try {
    // Using upsert to either insert a new record or update the viewed_at timestamp
    const { error } = await supabase
      .from('repo_view_history')
      .upsert(
        { 
          email, 
          provider, 
          owner, 
          repo, 
          viewed_at: new Date().toISOString() 
        },
        { 
          onConflict: 'email, provider, owner, repo',
          ignoreDuplicates: false 
        }
      );

    if (error) {
      console.error('Error adding repo to history:', error);
    }
  } catch (error) {
    console.error('Error in addRepoToHistory:', error);
  }
}

/**
 * Gets the repository view history for a user
 * Returns the most recently viewed repos first
 */
export async function getRepoHistory(email: string | null | undefined): Promise<RepoHistoryItem[]> {
  if (!email) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('repo_view_history')
      .select('id, provider, owner, repo, viewed_at')
      .eq('email', email)
      .order('viewed_at', { ascending: false });

    if (error) {
      console.error('Error fetching repo history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRepoHistory:', error);
    return [];
  }
} 