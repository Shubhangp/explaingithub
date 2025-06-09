// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkTokens() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment variables');
    process.exit(1);
  }
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Connecting to Supabase...');
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Check if we can query the user_provider_tokens table
    console.log('Checking user_provider_tokens table...');
    
    const { data: tokens, error: tokensError } = await supabase
      .from('user_provider_tokens')
      .select('*');
    
    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      process.exit(1);
    }
    
    console.log(`Found ${tokens.length} token records`);
    
    // Check tokens for specific user
    const testEmail = 'shivam.maurya@programmingwithmaurya.com';
    console.log(`Checking tokens for ${testEmail}...`);
    
    const { data: userTokens, error: userTokensError } = await supabase
      .from('user_provider_tokens')
      .select('*')
      .eq('email', testEmail);
    
    if (userTokensError) {
      console.error('Error fetching user tokens:', userTokensError);
    } else if (!userTokens || userTokens.length === 0) {
      console.log(`No tokens found for ${testEmail}`);
    } else {
      console.log(`Found ${userTokens.length} tokens for ${testEmail}:`);
      
      userTokens.forEach(token => {
        console.log(`- ${token.provider}: ${token.is_valid ? 'Valid' : 'Invalid'} (Last validated: ${token.last_validated_at})`);
      });
    }
    
    // Check database permissions for the anon key
    console.log('\nChecking database permissions...');
    
    const { data: permTest, error: permError } = await supabase
      .from('user_provider_tokens')
      .select('id')
      .limit(1);
    
    console.log('Permission test (select):', permError ? `Error: ${permError.message}` : 'Success');
    
    // Try to insert a test record
    const { error: insertError } = await supabase
      .from('user_provider_tokens')
      .insert({
        email: 'test@example.com',
        provider: 'test',
        access_token: 'test_token',
        is_valid: true,
        last_validated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    console.log('Permission test (insert):', insertError ? `Error: ${insertError.message}` : 'Success');
    
    // Clean up test record
    if (!insertError) {
      await supabase
        .from('user_provider_tokens')
        .delete()
        .eq('email', 'test@example.com');
      
      console.log('Test record cleaned up');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkTokens(); 