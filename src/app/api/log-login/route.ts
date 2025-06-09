import { NextResponse } from 'next/server'
import { logUserLogin } from '@/src/lib/google-sheets'

export async function POST(request: Request) {
  try {
    const { email, name, ipAddress } = await request.json()
    
    const result = await logUserLogin({
      email,
      name,
      ipAddress,
    })

    if (!result.success) {
      throw new Error('Failed to log user login')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in log-login API:', error)
    return NextResponse.json(
      { error: 'Failed to log user login' },
      { status: 500 }
    )
  }
} 