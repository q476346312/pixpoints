import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    
    if (!username || username.length < 3) {
      return NextResponse.json({ error: '账号至少3个字符' }, { status: 400 })
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: '账号只能包含字母、数字、下划线' }, { status: 400 })
    }
    
    if (!password || password.length < 6) {
      return NextResponse.json({ error: '密码至少6位' }, { status: 400 })
    }

    // Hash password
    const passwordHash = createHash('sha256').update(password).digest('hex')

    // Check if username exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (existing) {
      return NextResponse.json({ error: '该账号已存在，请直接登录' }, { status: 400 })
    }

    // Create new user
    const { error } = await supabase.from('users').insert({
      username,
      password_hash: passwordHash,
      points: 0,
    })

    if (error) {
      console.error('Register error:', error)
      return NextResponse.json({ error: '注册失败，请重试' }, { status: 500 })
    }

    return NextResponse.json({ message: '注册成功，请登录' })
  } catch (e: any) {
    console.error('register error:', e)
    return NextResponse.json({ error: e.message || '注册失败' }, { status: 500 })
  }
}
