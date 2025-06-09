import { NextResponse } from 'next/server'
import { logUserLogin } from '@/app/lib/supabase-utils'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  console.log('log-login API called');
  
  try {
    const { email, name } = await request.json();
    
    console.log('Received login data:', { email, name });
    
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }
    
    // Get IP address from headers
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    console.log('Logging login for:', { email, name, ipAddress });
    
    // Log to Supabase
    const result = await logUserLogin({ email, name, ipAddress });
    
    if (!result.success) {
      console.error('Error logging login:', result.error);
      return NextResponse.json(
        { error: 'Failed to log login' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in log-login API:', error);
    return NextResponse.json(
      { error: 'Server error processing login log' },
      { status: 500 }
    );
  }
} 