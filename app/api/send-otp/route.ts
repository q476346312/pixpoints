import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes

// In-memory OTP store (for dev; use Redis in production)
const otpStore = new Map<string, { code: string; expires: number }>()

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: '无效的邮箱地址' }, { status: 400 })
    }

    // Ensure user exists in DB
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single()
    if (!existing) {
      await supabase.from('users').insert({ email, points: 0 })
    }

    // Generate 6-digit OTP
    const code = String(randomInt(100000, 999999))
    otpStore.set(email, { code, expires: Date.now() + OTP_TTL_MS })

    // For testing: return the OTP directly
    // In production, replace with actual email sending
    console.log(`[DEV] OTP for ${email}: ${code}`)
    
    return NextResponse.json({ 
      message: '验证码已发送（开发模式：控制台查看验证码）',
      dev_code: code // Remove this in production
    })
  } catch (e: any) {
    console.error('send-otp error:', e)
    return NextResponse.json({ error: e.message || '发送失败' }, { status: 500 })
  }
}
