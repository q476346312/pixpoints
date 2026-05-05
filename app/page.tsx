'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Download, Zap, Star, LogOut, Play, X, Search, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react'
import NavBar from '@/components/NavBar'
import styles from './page.module.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Material {
  id: string
  name: string
  file_url: string
  thumbnail_url: string | null
  preview_url: string | null  // 10秒预览片段
  cost_points: number
  downloads_left: number | null
  delete_after_download: boolean
  purchased_users: string[]
  category: string | null
  created_at: string
}

interface User {
  id: string
  username?: string
  email?: string
  points: number
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // 搜索 + 分页
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 12

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
      const res = await fetch(`/api/stream/${materialId}`, {
        headers: { 'x-user-id': user?.id || '' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '获取视频失败')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setBlobUrls(prev => ({ ...prev, [materialId]: url }))
      return url
    } catch (e: any) {
      showToast(e.message || '加载视频失败', 'error')
      return null
    }
  }

  // 点击播放：直接打开全屏，用 preview_url（10秒片段）
  function handlePlay(mat: Material) {
    if (!mat.preview_url) {
      showToast('该素材暂无预览', 'error')
      return
    }
    setExpandedId(mat.id)
  }

  function handleCloseExpanded() {
    setExpandedId(null)
  }

  async function handleDownload(mat: Material) {
    if (!user) return
    setDownloadingId(mat.id)

    try {
      // 后端原子化处理：鉴权 → 扣积分 → 删文件 → 更新数据库
      const payRes = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: mat.id, userId: user.id }),
      })
      const payData = await payRes.json()
      if (!payRes.ok) throw new Error(payData.error || '下载失败')

      // 扣费成功，拉取文件
      const res = await fetch(`/api/stream/${mat.id}?download=1`, {
        headers: { 'x-user-id': user.id },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '获取文件失败')
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = mat.name + '.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)

      // 更新前端积分（用后端返回的权威值）
      setUser(prev => prev ? { ...prev, points: payData.remainingPoints } : null)
      localStorage.setItem('ps_user', JSON.stringify({ ...user, points: payData.remainingPoints }))

      // 更新素材列表
      if (payData.shouldDelete) {
        setMaterials(prev => prev.filter(m => m.id !== mat.id))
      } else {
        setMaterials(prev => prev.map(m => {
          if (m.id !== mat.id) return m
          const updated = { ...m }
          if (!mat.purchased_users?.includes(user.id) && mat.downloads_left === null) {
            updated.purchased_users = [...(m.purchased_users || []), user.id]
          }
          if (m.downloads_left !== null) {
            updated.downloads_left = m.downloads_left - 1
          }
          return updated
        }))
      }

      const payMsg = payData.needPay ? `-${payData.pointsDeducted}积分` : '已购买，免费下载'
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

  // 过滤 + 分页逻辑
  const filteredMaterials = materials.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE)
  const paginatedMaterials = filteredMaterials.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

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

      {/* Stats + Search */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
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

          {/* Search */}
          <div className="glass-card" style={{ padding: '10px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, minWidth: 280 }}>
            <Search size={18} color="#64748b" />
            <input
              type="text"
              placeholder="搜索素材..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1) // 重置到第一页
              }}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e2e8f0',
                fontSize: 14,
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setCurrentPage(1) }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Materials Grid */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>可用素材</h2>
          {searchQuery && (
            <span style={{ fontSize: 13, color: '#64748b' }}>
              找到 {filteredMaterials.length} 个结果
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="glass-card" style={{ padding: 60, textAlign: 'center', borderRadius: 16 }}>
            <p style={{ color: '#94a3b8' }}>
              {searchQuery ? '未找到匹配的素材' : '暂无素材，管理员上传后即可见'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
              {paginatedMaterials.map((mat, i) => {
              const isLoading = loadingId === mat.id
              const hasPurchased = user && mat.purchased_users?.includes(user.id)

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
                >
                  {/* 预览区域：缩略图 + 播放按钮 或 加载动画 */}
                  <div className={styles.materialThumb} style={{ height: 160, background: 'linear-gradient(135deg, #1a1a2e, #2a2a3e)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>

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
                    {/* 已购买标签 */}
                    {hasPurchased && (
                      <div style={{
                        marginTop: 10,
                        padding: '4px 10px',
                        background: 'rgba(34,197,94,0.15)',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: '#22c55e',
                        fontWeight: 500,
                      }}>
                        <CheckCircle size={12} />
                        已购买 · 免费下载
                      </div>
                    )}
                    <button
                      onClick={() => handleDownload(mat)}
                      disabled={downloadingId === mat.id || (!hasPurchased && mat.cost_points > user.points)}
                      style={{
                        marginTop: 12,
                        width: '100%',
                        padding: '10px',
                        borderRadius: 10,
                        border: 'none',
                        background: hasPurchased
                          ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                          : mat.cost_points > user.points
                            ? 'rgba(239,68,68,0.1)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: (!hasPurchased && mat.cost_points > user.points) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                      }}
                    >
                      {downloadingId === mat.id ? (
                        <div className="spinner-sm" />
                      ) : hasPurchased ? (
                        <>
                          <Download size={14} />
                          再次下载
                        </>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(99,102,241,0.3)',
                    background: currentPage === 1 ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.1)',
                    color: currentPage === 1 ? '#64748b' : '#e2e8f0',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(99,102,241,0.3)',
                      background: currentPage === page ? '#6366f1' : 'rgba(99,102,241,0.1)',
                      color: currentPage === page ? 'white' : '#e2e8f0',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      minWidth: 36,
                    }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(99,102,241,0.3)',
                    background: currentPage === totalPages ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.1)',
                    color: currentPage === totalPages ? '#64748b' : '#e2e8f0',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronRight size={16} />
                </button>

                <span style={{ marginLeft: 12, fontSize: 13, color: '#64748b' }}>
                  第 {currentPage} / {totalPages} 页
                </span>
              </div>
            )}
          </>
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
              className={styles.overlayCloseBtn}
              onClick={handleCloseExpanded}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* 视频预览（用 preview_url，10秒片段） */}
          <div style={{ width: '100%', maxWidth: 1000, padding: '60px 24px 24px' }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={expandedMat.preview_url || ''}
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
