import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '../auth/options';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check if the user is already logged in via session
    const session = await getServerSession(authOptions);
    if (session) {
      return NextResponse.json({ authorized: true });
    }

    // Check if there's a GitHub authorization cookie
    const cookieStore = cookies();
    const githubAuthCookie = cookieStore.get('github-authorized');
    if (githubAuthCookie?.value === 'true') {
      return NextResponse.json({ authorized: true });
    }

    // Check Google Sheets database for this user/IP if needed
    // This would require getting and checking IP address or device info
    // against previously stored information in your sheets database

    // If no indication of prior authorization is found
    return NextResponse.json({ authorized: false });
  } catch (error) {
    console.error('Error checking GitHub authorization:', error);
    return NextResponse.json({ authorized: false, error: 'Failed to check authorization' });
  }
} 