import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Your GitHub API logic here
  return NextResponse.json({ message: 'GitHub API endpoint' })
}

export async function POST(request: NextRequest) {
  const data = await request.json()
  // Your POST logic here
  return NextResponse.json({ message: 'Data received' })
} 