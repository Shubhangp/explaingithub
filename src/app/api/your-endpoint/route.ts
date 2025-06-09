import { NextResponse } from 'next/server'

export async function GET() {
  // Your API logic here
  return NextResponse.json({ message: 'Hello from API' })
}

export async function POST(request: Request) {
  const data = await request.json()
  // Your POST logic here
  return NextResponse.json({ message: 'Data received' })
} 