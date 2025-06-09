import { NextResponse } from 'next/server'
import { saveUserLoginInfo } from '@/app/lib/supabase-utils'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  console.log('log-login-info API called');
  
  try {
    const { email } = await request.json();
    
    console.log('Received login info data:', { email });
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Get IP address from headers
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    console.log('Logging login info for:', { email, ipAddress });
    
    // Log to Supabase
    const result = await saveUserLoginInfo({ email, ipAddress });
    
    if (!result.success) {
      console.error('Error logging login info:', result.error);
      return NextResponse.json(
        { error: 'Failed to log login info' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in log-login-info API:', error);
    return NextResponse.json(
      { error: 'Server error processing login info log' },
      { status: 500 }
    );
  }
} 