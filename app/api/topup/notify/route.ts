/**
 * POST /api/topup/notify
 * 支付宝异步回调（无需登录，任何人都能访问）
 * 接收支付宝服务器通知，验证签名后加积分
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyNotify } from '@/lib/alipay'

export async function POST(req: NextRequest) {
  try {
    // 支付宝使用 application/x-www-form-urlencoded
    const body = await req.text()
    const params: Record<string, string> = {}
    body.split('&').forEach(pair => {
      const [k, ...v] = pair.split('=')
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v.join('='))
    })

    console.log('[topup/notify] received:', params)

    // 1. 验证签名
    if (!verifyNotify(params)) {
      console.warn('[topup/notify] signature verify failed')
      return NextResponse.json({ code: 'FAIL', msg: '签名验证失败' }, { status: 400 })
    }

    // 2. 处理通知类型（trade_status_sync = 交易状态变更）
    const { out_trade_no, trade_status, trade_no, buyer_logon_id, total_amount } = params

    if (!out_trade_no) {
      return NextResponse.json({ code: 'FAIL', msg: '缺少订单号' })
    }

    // 查订单
    const { data: order, error } = await supabaseAdmin
      .from('topup_orders')
      .select('*')
      .eq('out_trade_no', out_trade_no)
      .single()

    if (error || !order) {
      console.warn('[topup/notify] order not found:', out_trade_no)
      return NextResponse.json({ code: 'FAIL', msg: '订单不存在' })
    }

    // 已处理过，直接返回 success
    if (order.status === 'PAID' || order.status === 'CLOSED') {
      return NextResponse.json({ code: 'SUCCESS', msg: 'OK' })
    }

    // 3. 状态映射
    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      // 加积分
      const { error: rpcErr } = await supabaseAdmin.rpc('inc_points', {
        uid:   order.user_id,
        delta: order.points,
      })

      if (rpcErr) {
        console.error('[topup/notify] inc_points failed:', rpcErr)
        // 返回 FAIL 让支付宝重试
        return NextResponse.json({ code: 'FAIL', msg: '加积分失败' })
      }

      await supabaseAdmin
        .from('topup_orders')
        .update({
          status:        'PAID',
          paid_at:       new Date().toISOString(),
          trade_no:      trade_no,
          buyer_account: buyer_logon_id,
        })
        .eq('order_id', order.order_id)

      console.log(`[topup/notify] PAID: ${out_trade_no}, +${order.points} points to user ${order.user_id}`)
    } else if (trade_status === 'TRADE_CLOSED') {
      await supabaseAdmin
        .from('topup_orders')
        .update({ status: 'CLOSED' })
        .eq('order_id', order.order_id)
    }

    return NextResponse.json({ code: 'SUCCESS', msg: 'OK' })
  } catch (e: any) {
    console.error('[topup/notify] error:', e)
    return NextResponse.json({ code: 'FAIL', msg: e.message })
  }
}
