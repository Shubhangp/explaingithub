import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/options';
import { createClient } from '@/app/lib/supabase-server';

/**
 * API route to handle the redirection after linking a provider.
 * This ensures that secondary provider auth doesn't overwrite the primary provider.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated session
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Get URL parameters
    const searchParams = new URL(request.url).searchParams;
    const provider = searchParams.get('provider');
    const redirectUrl = searchParams.get('redirect') || '/profile';

    // Log the provider linking action
    console.log(`Handling provider linking callback for ${provider}`);

    // Fetch all tokens for the user from database
    const supabase = createClient();
    const { data: tokens, error } = await supabase
      .from('user_provider_tokens')
      .select('provider, access_token, is_valid')
      .eq('email', session.user.email);

    if (error) {
      console.error('Error fetching user tokens:', error);
    } else if (tokens && tokens.length > 0) {
      console.log(`Found ${tokens.length} provider tokens for user:`, 
        tokens.map(t => t.provider).join(', '));
    }

    // Force refresh the tokens in the client
    const destinationUrl = new URL(redirectUrl, request.url);
    destinationUrl.searchParams.set('refresh-tokens', 'true');
    
    return NextResponse.redirect(destinationUrl);
  } catch (error) {
    console.error('Error in link-provider callback:', error);
    return NextResponse.redirect(new URL('/error?message=linking-failed', request.url));
  }
} 