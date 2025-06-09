import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/options';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('GitHub email check - API endpoint called');
    
    // Get the current session
    const session = await getServerSession(authOptions);
    
    console.log('GitHub email check - Session data:', session ? 'Session exists' : 'No session');
    if (session?.user) {
      console.log('GitHub email check - User in session:', session.user.name || 'No name');
      console.log('GitHub email check - Email in session:', session.user.email || 'No email');
    }
    
    // Check if the user is signed in
    if (!session || !session.user) {
      console.log('GitHub email check - No user session found');
      return NextResponse.json({ 
        error: 'User not signed in',
        email: null,
        status: 'no_session'
      }, { status: 401 });
    }
    
    // Check if email exists in the session
    if (!session.user.email) {
      console.log('GitHub email check - No email in user session');
      return NextResponse.json({ 
        error: 'No email in session',
        email: null,
        status: 'no_email'
      });
    }
    
    console.log('GitHub email check - Found email:', session.user.email);
    
    // Return the email from the session
    return NextResponse.json({ 
      email: session.user.email,
      status: 'success'
    });
  } catch (error) {
    console.error('Error getting GitHub email:', error);
    return NextResponse.json({ 
      error: 'Failed to get GitHub email',
      email: null,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 