import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { userId, email, usdAmount } = await req.json()
    if (!userId || !email || !usdAmount) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 })
    }

    const pointsAdded = Math.floor(usdAmount * 1000)

    // Create order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('topup_orders')
      .insert({
        user_id: userId,
        user_email: email,
        usd_amount: usdAmount,
        points_added: pointsAdded,
        status: 'pending',
      })
      .select()
      .single()
    if (orderErr) throw orderErr

    // Build Payoneer Checkout URL
    // NOTE: Replace with actual Payoneer Checkout API integration
    // See: https://developer.payoneer.com/docs/checkout
    const checkoutUrl = new URL(`${process.env.NEXT_PUBLIC_PAYONEER_CHECKOUT_URL}/checkout`)
    checkoutUrl.searchParams.set('client_id', process.env.PAYONEER_CLIENT_ID || '')
    checkoutUrl.searchParams.set('order_id', order.id)
    checkoutUrl.searchParams.set('amount', String(usdAmount))
    checkoutUrl.searchParams.set('currency', 'USD')
    checkoutUrl.searchParams.set('success_url', `${process.env.TOPUP_SUCCESS_REDIRECT}?order=${order.id}`)
    checkoutUrl.searchParams.set('cancel_url', process.env.TOPUP_CANCEL_REDIRECT || '')

    return NextResponse.json({ checkoutUrl: checkoutUrl.toString(), orderId: order.id })
  } catch (e: any) {
    console.error('topup/initiate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
