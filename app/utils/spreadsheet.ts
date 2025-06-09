import { getISTDateTime } from '@/app/lib/supabase-utils';
import supabase from '@/app/lib/supabase';

interface SpreadsheetData {
  name: string;
  email: string;
  username: string;
  organization?: string;
  purpose?: string;
}

export async function saveToSpreadsheet(data: SpreadsheetData) {
  try {
    // Get current date/time in IST
    const timestamp = getISTDateTime();
    
    console.log('Saving user data to Supabase:', data.email);
    
    // First check if a "users" table exists in Supabase, if not create it
    // This is a one-time operation to migrate the structure
    
    // Insert data into a users table in Supabase
    const { error } = await supabase
      .from('users')
      .insert({
        name: data.name,
        email: data.email,
        username: data.username,
        organization: data.organization || '',
        purpose: data.purpose || '',
        signup_date: timestamp.date,
        signup_time: timestamp.time
      });
      
    if (error) throw error;
    
    console.log('Successfully saved data to Supabase for', data.email);
    return { success: true };
    
  } catch (error) {
    console.error('Error saving to Supabase:', error);
    return { success: false, error };
  }
} 