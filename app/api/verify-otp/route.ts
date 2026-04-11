import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const otpStore = new Map<string, { code: string; expires: number }>()

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()
    if (!email || !code) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const stored = otpStore.get(email)
    if (!stored || stored.code !== code || Date.now() > stored.expires) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 401 })
    }

    otpStore.delete(email) // one-time use

    // Get or create user
    let { data: user, error } = await supabase.from('users').select('*').eq('email', email).single()
    if (error || !user) {
      const { data: newUser, error: createErr } = await supabase.from('users').insert({ email, points: 0 }).select().single()
      if (createErr) throw createErr
      user = newUser
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, points: user.points },
    })
  } catch (e: any) {
    console.error('verify-otp error:', e)
    return NextResponse.json({ error: e.message || '验证失败' }, { status: 500 })
  }
}
