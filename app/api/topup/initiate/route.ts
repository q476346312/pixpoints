/**
 * POST /api/topup/initiate
 * 创建支付订单，返回支付宝二维码 URL
 *
 * Body: { userId: string, points: number }
 * Response: { orderId, qrCode, outTradeNo, amount }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { tradePrecreate } from '@/lib/alipay'

function genOrderId() {
  return `PP${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function POST(req: NextRequest) {
  try {
    const { userId, points } = await req.json()

    if (!userId || !points || points < 5000) {
      return NextResponse.json({ error: '参数错误，最低充值5000积分' }, { status: 400 })
    }

    // 金额（元）= 积分（1元=1积分）
    const amount = points
    const orderId = genOrderId()
    const outTradeNo = orderId   // 支付宝订单号即我们系统的 orderId
    const subject = `PixPoints充值 ${points} 积分`

    // 查用户
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('id', userId)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 生成支付宝二维码 URL
    let qrCode = ''
    try {
      qrCode = await tradePrecreate(outTradeNo, amount, subject, 5)
    } catch (e: any) {
      // 沙箱/未配置时返回提示
      console.error('[alipay] tradePrecreate failed:', e.message)
      return NextResponse.json(
        { error: `支付通道暂不可用（${e.message}），请检查后台是否已配置支付宝密钥'`, qrCode: '' },
        { status: 503 },
      )
    }

    // 写订单记录（WAIT_BUYER_PAY = 待支付）
    await supabaseAdmin.from('topup_orders').insert({
      order_id:     orderId,
      user_id:      userId,
      out_trade_no: outTradeNo,
      amount,
      points,
      status:       'WAIT_BUYER_PAY',
    })

    return NextResponse.json({ orderId, qrCode, outTradeNo, amount, points })
  } catch (e: any) {
    console.error('[topup/initiate]', e)
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 })
  }
}
