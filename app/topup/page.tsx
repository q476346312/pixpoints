'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import NavBar from '@/components/NavBar'
import { CheckCircle, XCircle, Zap, ArrowLeft } from 'lucide-react'

const AMOUNTS = [
  { label: '$5', usd: 5, points: 5000 },
  { label: '$10', usd: 10, points: 10000 },
  { label: '$20', usd: 20, points: 20000 },
  { label: '$50', usd: 50, points: 50000 },
  { label: '$100', usd: 100, points: 100000 },
]

export default function TopupPage() {
  const router = useRouter()
  const params = useSearchParams()
  const status = params.get('status')
  const [user, setUser] = useState<any>(null)
  const [selected, setSelected] = useState(AMOUNTS[1]) // 默认 $10
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('ps_user')
    if (!raw) { router.push('/login'); return }
    setUser(JSON.parse(raw))
  }, [])

  async function handleTopup() {
    setLoading(true)
    try {
      const res = await fetch('/api/topup/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, usdAmount: selected.usd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.checkoutUrl
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  if (status === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="glass-card" style={{ maxWidth: 400, width: '100%', padding: 40, borderRadius: 24, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={32} color="#22c55e" />
          </div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>充值成功！</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
            积分已到账，请刷新页面查看余额
          </p>
          <button
            onClick={() => { router.push('/'); router.refresh() }}
            style={{ padding: '12px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            返回素材站
          </button>
        </div>
      </div>
    )
  }

  if (status === 'cancel') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="glass-card" style={{ maxWidth: 400, width: '100%', padding: 40, borderRadius: 24, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <XCircle size={32} color="#ef4444" />
          </div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>充值已取消</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>支付未完成，积分未到账</p>
          <button onClick={() => router.back()} style={{ padding: '12px 32px', borderRadius: 12, border: '1px solid #2a2a3e', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
            返回充值页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
      <NavBar user={user} onLogout={() => { localStorage.removeItem('ps_user'); router.push('/login') }} />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px 60px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginBottom: 32, fontSize: 14 }}>
          <ArrowLeft size={16} /> 返回
        </button>

        <div style={{ marginBottom: 8, fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={14} color="#fbbf24" /> 充值积分
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          选择充值金额
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 32 }}>
          1 USD = 1000 积分 · 积分可无限期使用
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 32 }}>
          {AMOUNTS.map(a => (
            <button
              key={a.label}
              onClick={() => setSelected(a)}
              style={{
                padding: '20px 16px', borderRadius: 16,
                border: selected.usd === a.usd
                  ? '2px solid #6366f1'
                  : '1px solid #2a2a3e',
                background: selected.usd === a.usd
                  ? 'rgba(99,102,241,0.1)'
                  : '#1a1a2e',
                cursor: 'pointer', textAlign: 'center',
                transition: 'all 0.2s',
                boxShadow: selected.usd === a.usd ? '0 0 20px rgba(99,102,241,0.15)' : 'none',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: selected.usd === a.usd ? '#6366f1' : '#e2e8f0' }}>
                {a.label}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                {a.points.toLocaleString()} 积分
              </div>
            </button>
          ))}
        </div>

        <div className="glass-card" style={{ padding: 20, borderRadius: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>充值金额</span>
            <span style={{ fontWeight: 600 }}>{selected.usd} USD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>汇率</span>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>1 USD = 1000 积分</span>
          </div>
          <div style={{ borderTop: '1px solid #2a2a3e', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14 }}>获得积分</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#fbbf24' }}>
              {selected.points.toLocaleString()} ⚡
            </span>
          </div>
        </div>

        <button
          onClick={handleTopup}
          disabled={loading}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: loading ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: loading ? 'none' : '0 0 30px rgba(99,102,241,0.35)',
          }}
        >
          {loading ? (
            <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <>通过派安盈支付 {selected.label}</>
          )}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 16 }}>
          支付由派安盈（Payoneer）提供，支持 Visa / Mastercard / Payoneer余额
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
