import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'

// This function replaces the withAuth middleware to allow
// public access to repository pages while still protecting
// the repositories list page that needs authentication
export async function middleware(req: NextRequest) {
  // Only apply auth check for the repositories page
  // Repository paths like /:owner/:repo should not be restricted
  if (req.nextUrl.pathname === '/repositories') {
    const session = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    // If no session exists, redirect to login
    if (!session) {
      const url = new URL('/login', req.url)
      url.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(url)
    }
  }

  // Allow all other requests to continue
  return NextResponse.next()
}

// Only apply middleware to the repositories page
// Explicitly exclude all other patterns to ensure repository paths are not matched
export const config = {
  matcher: [
    '/repositories',
  ],
} 