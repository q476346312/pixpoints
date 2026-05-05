/**
 * GET /api/topup/query?orderId=xxx
 * 查询订单状态，返回PAID即给用户加积分
 *
 * Response: { status: 'WAIT_BUYER_PAY' | 'PAID' | 'CLOSED' | 'EXPIRED', points, amount }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { tradeQuery } from '@/lib/alipay'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('orderId')

  if (!orderId) {
    return NextResponse.json({ error: '缺少 orderId' }, { status: 400 })
  }

  try {
    // 查本地订单
    const { data: order, error } = await supabaseAdmin
      .from('topup_orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 已支付/已关闭直接返回
    if (order.status === 'PAID') {
      return NextResponse.json({ status: 'PAID', points: order.points, amount: order.amount })
    }
    if (order.status === 'CLOSED') {
      return NextResponse.json({ status: 'CLOSED', points: order.points, amount: order.amount })
    }

    // 向支付宝查真实状态
    let alipayStatus: string = 'UNKNOWN'
    try {
      const result = await tradeQuery(order.out_trade_no)
      if (result) {
        alipayStatus = result.status
      }
    } catch (e: any) {
      console.warn('[topup/query] alipay query failed:', e.message)
      return NextResponse.json({
        status: 'WAIT_BUYER_PAY',
        points: order.points,
        amount: order.amount,
        debug: 'alipay_unreachable',
      })
    }

    // 映射状态
    let ourStatus: string
    if (alipayStatus === 'TRADE_SUCCESS' || alipayStatus === 'TRADE_FINISHED') {
      ourStatus = 'PAID'
    } else if (alipayStatus === 'TRADE_CLOSED') {
      ourStatus = 'CLOSED'
    } else {
      ourStatus = 'WAIT_BUYER_PAY'
    }

    // 状态变了，需要更新
    if (ourStatus !== order.status) {
      if (ourStatus === 'PAID') {
        // 加积分
        const { error: addErr } = await supabaseAdmin.rpc('inc_points', {
          uid:     order.user_id,
          delta:   order.points,
        })
        if (addErr) {
          console.error('[topup/query] inc_points failed:', addErr)
          // 不改变订单状态，下次重试
          return NextResponse.json({ status: 'ERROR', error: addErr.message, points: order.points, amount: order.amount })
        }
      }

      // 更新订单状态
      await supabaseAdmin
        .from('topup_orders')
        .update({ status: ourStatus, paid_at: ourStatus === 'PAID' ? new Date().toISOString() : null })
        .eq('order_id', orderId)
    }

    return NextResponse.json({ status: ourStatus, points: order.points, amount: order.amount })
  } catch (e: any) {
    console.error('[topup/query]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
