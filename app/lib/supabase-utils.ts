import supabase from './supabase';

export function getISTDateTime() {
  // Get current date in UTC
  const now = new Date();
  
  // Add 5 hours and 30 minutes to get IST
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  
  // Format date as YYYY-MM-DD for PostgreSQL
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0'); // UTC months are 0-indexed
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  
  // Manually format time as HH:MM:SS AM/PM
  let hours = istTime.getUTCHours();
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12 for 12 AM
  const formattedHours = String(hours).padStart(2, '0');
  
  const formattedDate = `${year}-${month}-${day}`;
  const formattedTime = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

  // Return both date and time separately
  return {
    date: formattedDate,
    time: `${formattedTime} IST`,
    // Also include the old format for backward compatibility
    oldFormatDate: `${day}/${month}/${year}`,
    // Keep the full timestamp for backward compatibility if needed
    fullTimestamp: `${formattedDate} ${formattedTime} IST`
  };
}

export async function logUserLogin({
  email,
  name,
  ipAddress,
}: {
  email: string;
  name: string;
  ipAddress: string;
}) {
  try {
    console.log('Logging user login for:', email);
    
    const timestamp = getISTDateTime();
    
    // Insert into Supabase
    const { error } = await supabase
      .from('user_logins')
      .insert({
        email,
        name,
        login_date: timestamp.date,
        login_time: timestamp.time,
        ip_address: ipAddress
      });

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error logging user login:', error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
}

export async function saveUserLoginInfo({
  email,
  ipAddress,
}: {
  email: string;
  ipAddress: string;
}) {
  try {
    console.log('Saving login info for:', email);
    
    // Get current IST time
    const istTimestamp = getISTDateTime();
    
    // Insert into Supabase
    const { error } = await supabase
      .from('login_info')
      .insert({
        email,
        ip_address: ipAddress,
        login_date: istTimestamp.date,
        login_time: istTimestamp.time
      });

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error saving login info:', error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
}

export async function logChatQuestion({
  email,
  question,
}: {
  email: string;
  question: string;
}) {
  try {
    console.log('Logging chat question for:', email);
    
    const timestamp = getISTDateTime();
    
    // Insert into Supabase
    const { error } = await supabase
      .from('user_chats')
      .insert({
        email,
        question,
        chat_date: timestamp.date,
        chat_time: timestamp.time
      });

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error logging chat question:', error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
} 

export async function saveUserProviderToken({
  email,
  provider,
  accessToken,
  username,
}: {
  email: string;
  provider: string;
  accessToken: string;
  username: string;
}) {
  try {
    console.log(`Saving ${provider} token for user:`, email);
    
    // Check if the user already has a token for this provider
    const { data: existingTokens } = await supabase
      .from('user_provider_tokens')
      .select('*')
      .eq('email', email)
      .eq('provider', provider);
    
    if (existingTokens && existingTokens.length > 0) {
      // Update the existing token
      const { error } = await supabase
        .from('user_provider_tokens')
        .update({
          access_token: accessToken,
          username,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email)
        .eq('provider', provider);
      
      if (error) throw error;
    } else {
      // Create a new token entry
      const { error } = await supabase
        .from('user_provider_tokens')
        .insert({
          email,
          provider,
          access_token: accessToken,
          username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error saving ${provider} token:`, error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
}

export async function getUserProviderTokens(email: string) {
  try {
    if (!email) {
      return { success: false, error: 'Email is required' };
    }
    
    // Get all tokens for the user
    const { data, error } = await supabase
      .from('user_provider_tokens')
      .select('*')
      .eq('email', email);
    
    if (error) throw error;
    
    // Transform the data into a more usable format
    const tokens: Record<string, { accessToken: string; username: string }> = {};
    
    data?.forEach(item => {
      tokens[item.provider] = {
        accessToken: item.access_token,
        username: item.username,
      };
    });
    
    return { success: true, tokens };
  } catch (error) {
    console.error('Error retrieving user tokens:', error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
}

/**
 * Tests the Supabase database connection
 * @returns A promise that resolves to true if the connection is successful, false otherwise
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Supabase database connection...');
    
    // Simple query to test connection (select now() from the database)
    const { data, error } = await supabase.rpc('now');
    
    if (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
    
    console.log('Database connection successful:', data);
    return true;
  } catch (error) {
    console.error('Database connection test error:', error);
    
    // Try a fallback test if the RPC method is not available
    try {
      // Try to query a simple table that should exist
      const { data, error: fallbackError } = await supabase
        .from('user_logins')
        .select('count(*)', { count: 'exact', head: true });
      
      if (fallbackError) {
        console.error('Fallback database test failed:', fallbackError);
        return false;
      }
      
      console.log('Fallback database test successful');
      return true;
    } catch (fallbackTestError) {
      console.error('All database connection tests failed:', fallbackTestError);
      return false;
    }
  }
}

/**
 * Saves a conversation to the conversations table
 * @param {Object} data - Conversation data
 * @returns {Promise<{success: boolean, error?: any, id?: string}>}
 */
export async function saveConversation({
  userId,
  provider = 'github',
  owner,
  repo,
  title
}: {
  userId: string;
  provider?: string;
  owner: string;
  repo: string;
  title?: string;
}) {
  try {
    console.log('Saving conversation for user:', userId);
    
    // Check if a conversation with the same provider, owner, repo already exists
    const { data: existingConversation, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('owner', owner)
      .eq('repo', repo)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    
    if (existingConversation) {
      // Update the existing conversation
      console.log('Updating existing conversation:', existingConversation.id);
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          title: title || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConversation.id);
      
      if (updateError) throw updateError;
      
      return { success: true, id: existingConversation.id };
    } else {
      // Create a new conversation
      console.log('Creating new conversation');
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          provider,
          owner,
          repo,
          title: title || null
        })
        .select('id')
        .single();
      
      if (error) throw error;
      
      return { success: true, id: data.id };
    }
  } catch (error) {
    console.error('Error saving conversation:', error instanceof Error ? error.message : String(error));
    return { success: false, error };
  }
} 