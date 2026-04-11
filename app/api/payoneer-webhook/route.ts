import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('payoneer-signature') || ''

    // Verify webhook signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.PAYONEER_WEBHOOK_SECRET || '')
      .update(body)
      .digest('hex')
    if (signature !== expectedSig) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    const { event_type, order_id, payment_status } = payload

    if (event_type === 'payment.completed' && payment_status === 'success') {
      // Update order status
      const { data: order } = await supabaseAdmin
        .from('topup_orders')
        .select('user_id, points_added')
        .eq('id', order_id)
        .single()

      if (order) {
        await supabaseAdmin
          .from('topup_orders')
          .update({ status: 'completed' })
          .eq('id', order_id)

        // Add points to user
        await supabaseAdmin.rpc('increment_points', {
          p_user_id: order.user_id,
          p_points: order.points_added,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (e: any) {
    console.error('payoneer webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
