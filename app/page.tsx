'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Download, Zap, Star, LogOut, Play, X } from 'lucide-react'
import NavBar from '@/components/NavBar'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Material {
  id: string
  name: string
  file_url: string
  thumbnail_url: string | null
  cost_points: number
  downloads_left: number | null
  delete_after_download: boolean
  purchased_users: string[]
  category: string | null
  created_at: string
}

interface User {
  id: string
  email: string
  points: number
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // 视频预览相关
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null) // 正在加载 blob 的 id
  const [expandedId, setExpandedId] = useState<string | null>(null) // 全屏模态框的 id

  useEffect(() => {
    const raw = localStorage.getItem('ps_user')
    if (!raw) { window.location.href = '/login'; return }
    const u: User = JSON.parse(raw)
    setUser(u)
    // 每次进入页面，从数据库拉最新积分
    fetchUser(u.id, u)
    fetchMaterials()
  }, [])

  useEffect(() => {
    return () => {
      Object.values(blobUrls).forEach(url => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ESC 键关闭全屏
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedId) handleCloseExpanded()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expandedId])

  async function fetchUser(userId: string, fallback: User) {
    const { data } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()
    if (data && data.points !== fallback.points) {
      const updated = { ...fallback, points: data.points }
      localStorage.setItem('ps_user', JSON.stringify(updated))
      setUser(updated)
    }
  }

  async function fetchMaterials() {
    setLoading(true)
    const { data } = await supabase
      .from('materials')
      .select('*')
      .or(`downloads_left.is.null,downloads_left.gt.0`)
      .order('created_at', { ascending: false })
    setMaterials((data || []) as Material[])
    setLoading(false)
  }

  async function loadBlob(materialId: string): Promise<string | null> {
    if (blobUrls[materialId]) return blobUrls[materialId]
    try {
      const res = await fetch(`/api/stream/${materialId}`)
      if (!res.ok) throw new Error('获取视频失败')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setBlobUrls(prev => ({ ...prev, [materialId]: url }))
      return url
    } catch (e: any) {
      showToast(e.message || '加载视频失败', 'error')
      return null
    }
  }

  // 点击播放：先显示加载动画，加载完直接打开全屏
  async function handlePlay(mat: Material) {
    if (loadingId === mat.id) return // 已在加载中
    setLoadingId(mat.id)
    const url = await loadBlob(mat.id)
    setLoadingId(null)
    if (url) setExpandedId(mat.id)
  }

  function handleCloseExpanded() {
    setExpandedId(null)
  }

  async function handleDownload(mat: Material) {
    if (!user) return
    
    // 检查是否已购买（不限次下载且已在购买列表中）
    const hasPurchased = mat.purchased_users?.includes(user.id)
    const needPay = !hasPurchased || mat.downloads_left !== null
    
    if (needPay && mat.cost_points > user.points) {
      showToast('积分不足，请先充值', 'error')
      return
    }
    if (mat.downloads_left !== null && mat.downloads_left <= 0) {
      showToast('素材已售罄', 'error')
      return
    }
    setDownloadingId(mat.id)

    try {
      // 只有需要付费时才扣积分
      if (needPay) {
        const { error: pointsErr } = await supabase.rpc('deduct_points', {
          p_user_id: user.id,
          p_points: Number(mat.cost_points),
        })
        if (pointsErr) throw pointsErr
      }

      // 构建更新数据
      const updateData: any = {}
      
      // 如果不限次且未购买，添加到已购买列表
      if (mat.downloads_left === null && !hasPurchased) {
        updateData.purchased_users = [...(mat.purchased_users || []), user.id]
      }
      
      // 如果限次，减少次数
      let newLeft = mat.downloads_left
      if (mat.downloads_left !== null) {
        newLeft = mat.downloads_left - 1
        updateData.downloads_left = newLeft
      }
      
      // 如果下载后删除或次数用完，标记删除
      const shouldDelete = mat.delete_after_download || (newLeft !== null && newLeft <= 0)
      if (shouldDelete) {
        updateData.downloads_left = 0
        try {
          await fetch('/api/materials/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_url: mat.file_url }),
          })
        } catch (_) {}
      }
      
      // 执行更新
      if (Object.keys(updateData).length > 0) {
        await supabase.from('materials').update(updateData).eq('id', mat.id)
      }

      const res = await fetch(`/api/stream/${mat.id}?download=1`)
      if (!res.ok) throw new Error('下载失败，请重试')

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = mat.name + '.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)

      // 更新前端状态
      if (needPay) {
        setUser(prev => prev ? { ...prev, points: prev.points - mat.cost_points } : null)
      }
      
      // 如果删除后不再显示，从列表移除
      if (shouldDelete) {
        setMaterials(prev => prev.filter(m => m.id !== mat.id))
      } else {
        setMaterials(prev => prev.map(m =>
          m.id === mat.id
            ? { ...m, ...updateData }
            : m
        ))
      }

      const payMsg = needPay ? `-${mat.cost_points}积分` : '已购买，免费下载'
      showToast(`下载成功！${payMsg}`, 'success')
    } catch (e: any) {
      showToast(e.message || '下载失败', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── 全屏模态框 ───
  const expandedMat = expandedId ? materials.find(m => m.id === expandedId) : null

  if (!user) return null

  return (
    <div className="min-h-screen noise-bg" style={{ background: '#0f0f1a' }}>
      <NavBar user={user} onLogout={() => { localStorage.removeItem('ps_user'); window.location.href = '/login' }} />

      {/* Hero */}
      <section style={{ padding: '80px 24px 60px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="animate-fade-up">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 999, padding: '6px 16px', marginBottom: 24, fontSize: 13 }}>
            <Zap size={14} color="#6366f1" />
            <span style={{ color: '#a5b4fc' }}>素材库 · AI创作资源</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 700, marginBottom: 16 }}>
            高质量素材，<span className="gradient-text">一触即达</span>
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>
            每一次下载都是独一无二的数字资产
          </p>
        </div>
      </section>

      {/* Stats */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { icon: <Zap size={16}/>, label: '当前积分', value: user.points.toLocaleString() },
            { icon: <Star size={16}/>, label: '素材总数', value: materials.length },
          ].map(stat => (
            <div key={stat.label} className="glass-card" style={{ padding: '16px 24px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, minWidth: 160 }}>
              <div style={{ color: '#6366f1' }}>{stat.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Materials Grid */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>可用素材</h2>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : materials.length === 0 ? (
          <div className="glass-card" style={{ padding: 60, textAlign: 'center', borderRadius: 16 }}>
            <p style={{ color: '#94a3b8' }}>暂无素材，管理员上传后即可见</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {materials.map((mat, i) => {
              const isLoading = loadingId === mat.id

              return (
                <div
                  key={mat.id}
                  className="glass-card glow-border animate-fade-up"
                  style={{
                    borderRadius: 16,
                    overflow: 'hidden',
                    animationDelay: `${i * 60}ms`,
                    opacity: 0,
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {/* 预览区域：缩略图 + 播放按钮 或 加载动画 */}
                  <div style={{ height: 160, background: 'linear-gradient(135deg, #1a1a2e, #2a2a3e)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>

                    {/* 正在加载：显示 spinner，替代播放按钮 */}
                    {isLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div className="spinner" />
                        <span style={{ fontSize: 11, color: '#64748b' }}>加载中…</span>
                      </div>
                    ) : (
                      <>
                        {/* 缩略图 */}
                        {mat.thumbnail_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={mat.thumbnail_url} alt={mat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : null}

                        {/* 播放按钮覆盖层 */}
                        <button
                          onClick={() => handlePlay(mat)}
                          style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.3)',
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            width: 52, height: 52, borderRadius: '50%',
                            background: 'rgba(99,102,241,0.9)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                            transition: 'transform 0.2s',
                          }}>
                            <Play size={24} color="white" fill="white" />
                          </div>
                        </button>
                      </>
                    )}
                  </div>

                  {/* 卡片信息 */}
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, lineHeight: 1.4 }}>{mat.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={14} color="#fbbf24" />
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#fbbf24' }}>{mat.cost_points}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>积分</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {mat.downloads_left !== null ? `剩余 ${mat.downloads_left} 次` : '不限次数'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(mat)}
                      disabled={downloadingId === mat.id || mat.cost_points > user.points}
                      style={{
                        marginTop: 12,
                        width: '100%',
                        padding: '10px',
                        borderRadius: 10,
                        border: 'none',
                        background: mat.cost_points > user.points
                          ? 'rgba(239,68,68,0.1)'
                          : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: mat.cost_points > user.points ? '#ef4444' : 'white',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: mat.cost_points > user.points ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                      }}
                    >
                      {downloadingId === mat.id ? (
                        <div className="spinner-sm" />
                      ) : (
                        <>
                          <Download size={14} />
                          {mat.cost_points > user.points ? '积分不足' : '下载'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ─── 全屏模态框 ─── */}
      {expandedId && expandedMat && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) handleCloseExpanded()
          }}
        >
          {/* 顶部栏 */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(rgba(0,0,0,0.6), transparent)',
            zIndex: 10,
          }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>
              {expandedMat.name}
            </div>
            <button
              onClick={handleCloseExpanded}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            >
              <X size={18} />
            </button>
          </div>

          {/* 视频 */}
          <div style={{ width: '100%', maxWidth: 1000, padding: '60px 24px 24px' }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={blobUrls[expandedId] || ''}
              controls
              controlsList="nodownload noremoteplayback"
              playsInline
              onContextMenu={e => e.preventDefault()}
              style={{
                width: '100%',
                borderRadius: 12,
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                maxHeight: '85vh',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* 底部积分信息 */}
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 999, padding: '8px 20px',
          }}>
            <Zap size={14} color="#fbbf24" />
            <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14 }}>{expandedMat.cost_points}</span>
            <span style={{ color: '#a5b4fc', fontSize: 12 }}>积分 · 下载后自动扣减</span>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 24px', borderRadius: 12, zIndex: 999,
          background: toast.type === 'success' ? '#22c55e' : '#ef4444',
          color: 'white', fontWeight: 600, fontSize: 14,
          animation: 'slideIn 0.3s ease-out',
          boxShadow: `0 8px 32px ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .spinner {
          width: 40px; height: 40px;
          border: 3px solid #2a2a3e;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .spinner-sm {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
