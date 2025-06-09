import { NextResponse } from 'next/server';
import { getISTDateTime } from '@/app/lib/supabase-utils';
import supabase from '@/app/lib/supabase';

export async function POST(request: Request) {
  console.log('save-access-token API called');
  
  try {
    const { email, accessToken, name, username } = await request.json();
    
    console.log('Received data:', { 
      email, 
      name,
      username,
      accessTokenLength: accessToken ? accessToken.length : 0 
    });
    
    if (!email || !accessToken) {
      console.error('Missing required fields:', { hasEmail: !!email, hasToken: !!accessToken });
      return NextResponse.json(
        { error: 'Email and accessToken are required' },
        { status: 400 }
      );
    }
    
    // Get IST date and time
    const istDateTime = getISTDateTime();
    console.log('IST Date and Time:', istDateTime);
    
    // First, check if user exists
    console.log('Searching for user by email:', email);
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('email', email)
      .single();
      
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "No rows returned" error
      console.error('Error fetching user:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }
    
    if (!existingUser) {
      // User not found, add a new row
      console.log('User not found, adding new entry for:', email);
      
      const { error: insertError } = await supabase
        .from('user_tokens')
        .insert({
          email,
          name: name || '',
          username: username || '',
          access_token: accessToken,
          updated_date: istDateTime.date,
          updated_time: istDateTime.time
        });
        
      if (insertError) {
        console.error('Error inserting user token:', insertError);
        return NextResponse.json(
          { error: 'Failed to save access token' },
          { status: 500 }
        );
      }
      
      console.log('Added new user with access token');
    } else {
      // User found, update the existing row
      console.log('User found, updating existing record');
      
      const { error: updateError } = await supabase
        .from('user_tokens')
        .update({
          name: name || existingUser.name || '',
          username: username || existingUser.username || '',
          access_token: accessToken,
          updated_date: istDateTime.date,
          updated_time: istDateTime.time
        })
        .eq('email', email);
        
      if (updateError) {
        console.error('Error updating user token:', updateError);
        return NextResponse.json(
          { error: 'Failed to update access token' },
          { status: 500 }
        );
      }
      
      console.log('Updated existing user with new access token');
    }

    console.log('Successfully saved access token for user:', email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating access token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}