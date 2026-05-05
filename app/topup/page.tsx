'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { CheckCircle, XCircle, Zap, ArrowLeft, QrCode, RefreshCw } from 'lucide-react'

const PRESET_OPTIONS = [
  { points: 5000,  label: '5000',  remark: '¥5000' },
  { points: 10000, label: '10000', remark: '¥10000' },
  { points: 20000, label: '20000', remark: '¥20000' },
]

const MIN_POINTS = 5000

type Phase = 'select' | 'paying' | 'success' | 'cancel'

interface OrderInfo {
  orderId: string
  qrCode: string
  outTradeNo: string
  amount: number
  points: number
}

function TopupContent() {
  const router = useRouter()
  const params = useSearchParams()
  const status = params.get('status')

  const [phase, setPhase] = useState<Phase>('select')
  const [user, setUser] = useState<any>(null)
  const [selectedPoints, setSelectedPoints] = useState<number>(10000)
  const [customInput, setCustomInput] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(300)
  const [qrExpired, setQrExpired] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('ps_user')
    if (!raw) { router.push('/login'); return }
    setUser(JSON.parse(raw))
  }, [])

  // 轮询支付状态 + 充值成功后刷新用户积分
  useEffect(() => {
    if (phase !== 'paying' || !order) return
    timerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/topup/query?orderId=${order.orderId}`)
        const data = await res.json()
        if (data.status === 'PAID') {
          clearInterval(timerRef.current!)
          // 刷新用户积分到 localStorage
          await refreshUserPoints()
          setPhase('success')
        } else if (data.status === 'CLOSED') {
          clearInterval(timerRef.current!)
          setQrExpired(true)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, order])

  // 刷新用户积分
  async function refreshUserPoints() {
    try {
      const res = await fetch('/api/user')
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          const updated = { ...user, points: data.user.points }
          localStorage.setItem('ps_user', JSON.stringify(updated))
          setUser(updated)
        }
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (phase !== 'paying') return
    setCountdown(300)
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); setQrExpired(true); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [phase, order?.orderId])

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function currentPoints() {
    if (useCustom) {
      const v = parseInt(customInput)
      return isNaN(v) || v < MIN_POINTS ? 0 : v
    }
    return selectedPoints
  }

  async function handleCreateOrder() {
    const pts = currentPoints()
    if (pts < MIN_POINTS) { setError(`最低充值 ${MIN_POINTS} 积分`); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/topup/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, points: pts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '创建订单失败')
      setOrder({ orderId: data.orderId, qrCode: data.qrCode, outTradeNo: data.outTradeNo, amount: data.amount, points: pts })
      setPhase('paying')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function refreshQr() {
    setQrExpired(false)
    setCountdown(300)
    setPhase('select')
    setOrder(null)
  }

  if (!user) return null

  if (phase === 'success' || status === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', padding: '40px 32px', background: '#1a1a2e', borderRadius: 24, textAlign: 'center', border: '1px solid #2a2a3e' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle size={36} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>充值成功！</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            {order ? `${order.points.toLocaleString()} 积分已到账` : '积分已到账，请刷新页面查看余额'}
          </p>
          <button onClick={() => { window.location.href = '/' }}
            style={{ padding: '12px 36px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
            返回素材站
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'cancel' || status === 'cancel' || qrExpired) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', padding: '40px 32px', background: '#1a1a2e', borderRadius: 24, textAlign: 'center', border: '1px solid #2a2a3e' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <XCircle size={36} color="#ef4444" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>
            {qrExpired ? '二维码已过期' : '支付已取消'}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>
            {qrExpired ? '请重新发起支付' : '积分未到账，可重新发起充值'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={refreshQr} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              重新充值
            </button>
            <button onClick={() => router.back()} style={{ padding: '11px 24px', borderRadius: 12, border: '1px solid #2a2a3e', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>
              返回
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'paying' && order) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
        <NavBar user={user} onLogout={() => { localStorage.removeItem('ps_user'); router.push('/login') }} />
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
          <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setPhase('cancel') }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginBottom: 32, fontSize: 14 }}>
            <ArrowLeft size={16} /> 取消支付
          </button>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <QrCode size={28} color="#22c55e" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>请使用支付宝扫码支付</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 28 }}>支付成功后积分自动到账，无需手动确认</p>

          <div style={{ padding: '20px 24px', background: '#1a1a2e', borderRadius: 16, border: '1px solid #2a2a3e', marginBottom: 24, display: 'inline-block', minWidth: 260 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>支付金额</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#f59e0b' }}>¥{order.amount}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>获得 {order.points.toLocaleString()} 积分</div>
          </div>

          <div style={{ background: 'white', borderRadius: 20, padding: 24, display: 'inline-block', marginBottom: 20 }}>
            <img src={order.qrCode} alt="支付宝付款码" style={{ width: 240, height: 240, display: 'block' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: countdown <= 60 ? '#ef4444' : '#22c55e', animation: countdown <= 60 ? 'pulse 1s infinite' : 'none' }} />
            <span style={{ fontSize: 13, color: countdown <= 60 ? '#ef4444' : '#94a3b8' }}>
              二维码剩余 <strong>{formatTime(countdown)}</strong>
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>请在有效期内完成支付</p>
          <button onClick={refreshQr} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#6366f1', fontSize: 13, cursor: 'pointer' }}>
            <RefreshCw size={13} /> 刷新二维码
          </button>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
      </div>
    )
  }

  const pts = currentPoints()
  const amount = pts // 1元=1积分

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
      <NavBar user={user} onLogout={() => { localStorage.removeItem('ps_user'); router.push('/login') }} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px 60px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginBottom: 32, fontSize: 14 }}>
          <ArrowLeft size={16} /> 返回
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13, color: '#94a3b8' }}>
          <Zap size={14} color="#fbbf24" /> 充值积分
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>选择充值金额</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32 }}>支付宝安全支付 · 积分实时到账</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {PRESET_OPTIONS.map(opt => (
            <button key={opt.points}
              onClick={() => { setSelectedPoints(opt.points); setUseCustom(false); setError('') }}
              style={{
                padding: '20px 12px', borderRadius: 16,
                border: !useCustom && selectedPoints === opt.points ? '2px solid #6366f1' : '1px solid #2a2a3e',
                background: !useCustom && selectedPoints === opt.points ? 'rgba(99,102,241,0.12)' : '#1a1a2e',
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                boxShadow: !useCustom && selectedPoints === opt.points ? '0 0 24px rgba(99,102,241,0.18)' : 'none',
              }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: !useCustom && selectedPoints === opt.points ? '#6366f1' : '#e2e8f0' }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{opt.remark}</div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 28 }}>
          <button onClick={() => { setUseCustom(true); setError('') }}
            style={{
              width: '100%', padding: '16px', borderRadius: 14,
              border: useCustom ? '2px solid #6366f1' : '1px solid #2a2a3e',
              background: useCustom ? 'rgba(99,102,241,0.12)' : '#1a1a2e',
              cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', marginBottom: 10,
            }}>
            <span style={{ color: useCustom ? '#6366f1' : '#94a3b8', fontSize: 14 }}>自定义金额</span>
          </button>
          {useCustom && (
            <div style={{ position: 'relative' }}>
              <input type="number" placeholder={`最低 ${MIN_POINTS} 积分`}
                value={customInput}
                onChange={e => { setCustomInput(e.target.value); setError('') }}
                style={{ width: '100%', padding: '14px 80px 14px 16px', borderRadius: 12, border: '1px solid #3a3a5e', background: '#1a1a2e', color: '#e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 14, pointerEvents: 'none' }}>积分</span>
            </div>
          )}
        </div>

        {pts > 0 && (
          <div style={{ padding: '16px 20px', background: '#1a1a2e', borderRadius: 14, border: '1px solid #2a2a3e', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>充值积分</span>
              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{pts.toLocaleString()} ⚡</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>支付金额</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: '#f59e0b' }}>¥{amount}</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button onClick={handleCreateOrder} disabled={loading || pts < MIN_POINTS}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: loading || pts < MIN_POINTS ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontWeight: 700, fontSize: 16, cursor: loading || pts < MIN_POINTS ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading || pts < MIN_POINTS ? 'none' : '0 0 30px rgba(99,102,241,0.35)',
          }}>
          {loading ? (
            <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <>跳转支付宝支付 {pts > 0 ? `¥${amount}` : ''}</>
          )}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 16 }}>
          支付由支付宝提供保障，资金直接进入您的商家账户
        </p>
      </div>
      <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

export default function TopupPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
      </div>
    }>
      <TopupContent />
    </Suspense>
  )
}
