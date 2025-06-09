import { NextResponse } from 'next/server';
import { authenticateWithGitHub } from '@/app/lib/github-auth';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Authenticate the user with GitHub using their stored token
    const user = await authenticateWithGitHub(email);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to authenticate with GitHub. Access token may be invalid or missing.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      user
    });
  } catch (error) {
    console.error('Error in GitHub authentication API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 