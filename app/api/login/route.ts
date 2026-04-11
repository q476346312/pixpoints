import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    
    if (!username || !password) {
      return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 })
    }

    // Hash password
    const passwordHash = createHash('sha256').update(password).digest('hex')

    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, points')
      .eq('username', username)
      .eq('password_hash', passwordHash)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 })
    }

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set('user_id', String(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    cookieStore.set('user_name', user.username, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({ 
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        points: user.points,
      }
    })
  } catch (e: any) {
    console.error('login error:', e)
    return NextResponse.json({ error: e.message || '登录失败' }, { status: 500 })
  }
}
