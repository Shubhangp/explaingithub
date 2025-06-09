import { NextResponse } from 'next/server'
import { saveUserLoginInfo } from '@/src/lib/google-sheets'

export async function POST(request: Request) {
  console.log('log-login-info API called');
  
  try {
    // Parse the request body
    let body;
    try {
      body = await request.json();
      console.log('Received request body:', body);
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const { email, ipAddress } = body;
    
    // Validate input data
    if (!email) {
      console.error('Email is required but was not provided');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('Calling saveUserLoginInfo with:', { email, ipAddress });
    
    const result = await saveUserLoginInfo({
      email,
      ipAddress: ipAddress || 'Unknown',
    });

    console.log('saveUserLoginInfo result:', result);

    if (!result.success) {
      console.error('Failed to save user login info:', result.error);
      throw new Error('Failed to save user login info');
    }

    console.log('Successfully saved login info');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in log-login-info API:', error);
    return NextResponse.json(
      { error: 'Failed to save user login info', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 