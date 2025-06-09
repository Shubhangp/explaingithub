import { NextRequest, NextResponse } from 'next/server';

// Set cookie with expected GitHub email
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { email } = data;
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Create a response
    const response = NextResponse.json({ success: true });
    
    // Set a cookie with the expected email (lowercase for case-insensitive comparison)
    response.cookies.set('expected_github_email', email.toLowerCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes expiry
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Error setting expected email cookie:', error);
    return NextResponse.json(
      { error: 'Failed to set expected email' },
      { status: 500 }
    );
  }
} 