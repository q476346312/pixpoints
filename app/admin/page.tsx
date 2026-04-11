'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './admin.module.css'
import { createClient } from '@supabase/supabase-js'
import { Upload, Package, Users, CreditCard, Trash2, Edit2, Check, X, Search, Plus, Minus, LogOut, RefreshCw, Eye, Download, Layers, FolderOpen } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || 'admin').split(',').map(e => e.trim())
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function getPublicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`
}

// ============ Types ============
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
  _editing?: boolean
  _name?: string
  _cost?: string
  _downloads?: string
  _category?: string
  _deleteAfter?: boolean
}
interface DBUser {
  id: string
  username: string
  points: number
  created_at: string
}
interface Order {
  id: string
  user_id: string
  user_email: string
  usd_amount: number
  points_added: number
  status: string
  created_at: string
}

// ============ Material Row ============
function MaterialRow({
  mat, onSave, onDelete, onStartEdit, isEditing
}: {
  mat: Material
  onSave: () => void
  onDelete: () => void
  onStartEdit: () => void
  isEditing: boolean
}) {
  if (!isEditing) {
    return (
      <tr className={styles.tr}>
        <td className={styles.td}>
          <span className={styles.materialName}>{mat.name}</span>
        </td>
        <td className={styles.td}>
          {mat.category
            ? <span className={styles.tag}>{mat.category}</span>
            : <span className={styles.muted}>—</span>}
        </td>
        <td className={styles.td}>
          <span className={styles.points}>{mat.cost_points}</span>
        </td>
        <td className={styles.td}>
          {mat.downloads_left !== null
            ? <span className={styles.muted}>{mat.downloads_left} 次</span>
            : <span className={styles.tagGreen}>不限</span>}
          {mat.delete_after_download && <span className={styles.tagRed} style={{marginLeft: 6}}>购后删</span>}
        </td>
        <td className={styles.td}>
          <span className={styles.muted}>{new Date(mat.created_at).toLocaleDateString('zh-CN')}</span>
          {mat.purchased_users && mat.purchased_users.length > 0 && (
            <span className={styles.tag} style={{marginLeft: 6}}>{mat.purchased_users.length}人已购</span>
          )}
        </td>
        <td className={styles.tdActions}>
          <button className={styles.btnIcon} onClick={onStartEdit} title="编辑">
            <Edit2 size={14} />
          </button>
          <button className={`${styles.btnIcon} ${styles.btnDanger}`} onClick={onDelete} title="删除">
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`${styles.tr} ${styles.trEdit}`}>
      <td className={styles.td}>
        <input
          className={styles.inlineInput}
          value={mat._name}
          onChange={e => { mat._name = e.target.value }}
          placeholder="素材名称"
        />
      </td>
      <td className={styles.td}>
        <input
          className={styles.inlineInput}
          value={mat._category}
          onChange={e => { mat._category = e.target.value }}
          placeholder="分类"
        />
      </td>
      <td className={styles.td}>
        <input
          className={`${styles.inlineInput} ${styles.inlineInputSm}`}
          type="number"
          value={mat._cost}
          onChange={e => { mat._cost = e.target.value }}
          placeholder="积分"
        />
      </td>
      <td className={styles.td}>
        <input
          className={`${styles.inlineInput} ${styles.inlineInputSm}`}
          type="number"
          value={mat._downloads}
          onChange={e => { mat._downloads = e.target.value }}
          placeholder="次数"
        />
      </td>
      <td className={styles.td}><span className={styles.muted}>—</span></td>
      <td className={styles.tdActions}>
        <button className={`${styles.btnIcon} ${styles.btnSuccess}`} onClick={onSave} title="保存">
          <Check size={14} />
        </button>
        <button className={`${styles.btnIcon} ${styles.btnDanger}`} onClick={onStartEdit} title="取消">
          <X size={14} />
        </button>
      </td>
    </tr>
  )
}

// ============ User Row ============
function UserRow({
  user, onAdjust
}: {
  user: DBUser
  onAdjust: (delta: number) => void
}) {
  return (
    <tr className={styles.tr}>
      <td className={styles.td}>
        <span className={styles.materialName}>{user.username}</span>
      </td>
      <td className={styles.td}>
        <span className={styles.points}>{user.points.toLocaleString()}</span>
      </td>
      <td className={styles.td}>
        <span className={styles.muted}>{new Date(user.created_at).toLocaleDateString('zh-CN')}</span>
      </td>
      <td className={styles.tdActions}>
        <button className={styles.btnAdjust} onClick={() => onAdjust(-100)}>
          <Minus size={12} /> -100
        </button>
        <button className={`${styles.btnAdjust} ${styles.btnAdjustWarn}`} onClick={() => onAdjust(-1000)}>
          <Minus size={12} /> -1k
        </button>
        <button className={styles.btnAdjust} onClick={() => onAdjust(100)}>
          <Plus size={12} /> +100
        </button>
        <button className={`${styles.btnAdjust} ${styles.btnAdjustSuccess}`} onClick={() => onAdjust(1000)}>
          <Plus size={12} /> +1k
        </button>
        <button className={`${styles.btnAdjust} ${styles.btnAdjustPrimary}`} onClick={() => onAdjust(10000)}>
          <Plus size={12} /> +1w
        </button>
      </td>
    </tr>
  )
}

// ============ Order Row ============
function OrderRow({ order }: { order: Order }) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    completed: { label: '已完成', cls: styles.statusGreen },
    pending:   { label: '处理中', cls: styles.statusBlue },
    failed:    { label: '失败',   cls: styles.statusRed },
  }
  const s = statusMap[order.status] || { label: order.status, cls: styles.statusBlue }
  return (
    <tr className={styles.tr}>
      <td className={styles.td}><span className={styles.materialName}>{order.user_email}</span></td>
      <td className={styles.td}>
        <span style={{ color: '#22c55e', fontWeight: 700 }}>+{order.points_added.toLocaleString()}</span>
      </td>
      <td className={styles.td}><span style={{ color: '#94a3b8' }}>${order.usd_amount}</span></td>
      <td className={styles.td}><span className={`${styles.statusPill} ${s.cls}`}>{s.label}</span></td>
      <td className={styles.td}><span className={styles.muted}>{new Date(order.created_at).toLocaleString('zh-CN')}</span></td>
    </tr>
  )
}

// ============ Main Admin Page ============
export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<'materials' | 'users' | 'orders'>('materials')
  const [materials, setMaterials] = useState<Material[]>([])
  const [dbUsers, setDbUsers] = useState<DBUser[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadPoints, setUploadPoints] = useState('100')
  const [uploadDownloads, setUploadDownloads] = useState('')
  const [deleteAfterDownload, setDeleteAfterDownload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Batch upload state
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchQueue, setBatchQueue] = useState<{ file: File; status: 'pending' | 'uploading' | 'done' | 'error'; msg?: string }[]>([])
  const [batchUploading, setBatchUploading] = useState(false)

  // User search
  const [search, setSearch] = useState('')

  // Auth check
  useEffect(() => {
    const raw = localStorage.getItem('ps_admin')
    if (!raw) { router.push('/admin/login'); return }
    const u = JSON.parse(raw)
    if (!ADMIN_USERNAMES.includes(u.username)) {
      router.push('/admin/login')
      return
    }
    setUser(u)
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [mats, usrs, ords] = await Promise.all([
      supabase.from('materials').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('topup_orders').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    setMaterials((mats.data || []) as Material[])
    setDbUsers((usrs.data || []) as DBUser[])
    setOrders((ords.data || []) as Order[])
    setLoading(false)
  }

  // ---- Upload ----
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function doUploadOne(file: File, name: string) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name)
    fd.append('cost_points', uploadPoints)
    fd.append('delete_after_download', String(deleteAfterDownload))
    if (uploadDownloads) fd.append('downloads_left', uploadDownloads)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || '上传失败')
  }

  async function handleUpload() {
    if (!file) return alert('请选择文件')
    if (!uploadName.trim()) return alert('请填写素材名称')
    if (!uploadPoints) return alert('请填写积分价格')
    setUploading(true)
    try {
      await doUploadOne(file, uploadName.trim())
      setUploadName(''); setUploadPoints('100'); setUploadDownloads(''); setDeleteAfterDownload(false)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadAll()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setUploading(false)
    }
  }

  // ---- Batch Upload ----
  function handleBatchSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = Array.from(e.target.files || [])
    const MAX = 1 * 1024 * 1024 * 1024 // 1GB
    const valid = raw.filter(f => {
      if (f.size > MAX) {
        alert(`「${f.name}」超过1GB限制，已跳过`)
        return false
      }
      return true
    })
    setBatchFiles(valid)
    setBatchQueue(valid.map(f => ({ file: f, status: 'pending' as const })))
    if (e.target) e.target.value = ''
  }

  async function handleBatchUpload() {
    if (batchFiles.length === 0) return
    setBatchUploading(true)
    const queue = [...batchQueue]
    for (let i = 0; i < queue.length; i++) {
      queue[i] = { ...queue[i], status: 'uploading' }
      setBatchQueue([...queue])
      try {
        await doUploadOne(queue[i].file, queue[i].file.name.replace(/\.[^.]+$/, ''))
        queue[i] = { ...queue[i], status: 'done' }
      } catch (e: any) {
        queue[i] = { ...queue[i], status: 'error', msg: e.message }
      }
      setBatchQueue([...queue])
    }
    setBatchUploading(false)
    setBatchFiles([])
    setBatchQueue([])
    await loadAll()
  }

  // ---- Delete Material ----
  async function handleDelete(mat: Material) {
    if (!confirm(`确定删除「${mat.name}」？`)) return
    await fetch(`/api/materials?id=${mat.id}`, { method: 'DELETE' })
    await loadAll()
  }

  // ---- Start Edit ----
  function startEdit(mat: Material) {
    setMaterials(prev => prev.map(m =>
      m.id === mat.id
        ? { ...m, _editing: !m._editing, _name: m.name, _cost: String(m.cost_points), _downloads: String(mat.downloads_left ?? ''), _category: mat.category ?? '' }
        : { ...m, _editing: false }
    ))
  }

  // ---- Save Edit ----
  async function saveEdit(mat: Material) {
    const { error } = await supabase.from('materials').update({
      name: mat._name?.trim() || mat.name,
      cost_points: parseInt(mat._cost!) || mat.cost_points,
      downloads_left: mat._downloads ? parseInt(mat._downloads) : null,
      category: mat._category?.trim() || null,
    }).eq('id', mat.id)
    if (error) { alert('保存失败: ' + error.message); return }
    await loadAll()
  }

  // ---- Adjust Points ----
  async function handleAdjust(userId: string, currentPoints: number, delta: number) {
    const newVal = currentPoints + delta
    if (newVal < 0) { alert('积分不能为负数'); return }
    await supabase.from('users').update({ points: newVal }).eq('id', userId)
    await loadAll()
  }

  // Filtered users
  const filteredUsers = search.trim()
    ? dbUsers.filter(u => u.username.toLowerCase().includes(search.toLowerCase()))
    : dbUsers

  // Tab count badges
  const tabs = [
    { key: 'materials', label: '📦 素材管理', icon: <Package size={15} /> },
    { key: 'users',     label: '👥 用户积分', icon: <Users size={15} /> },
    { key: 'orders',    label: '💳 充值记录', icon: <CreditCard size={15} /> },
  ] as const

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <span className={styles.headerLogo}>PP</span>
            <span className={styles.headerTitle}>PixPoints</span>
            <span className={styles.headerBadge}>管理后台</span>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.headerUser}>👤 {user?.username || user?.email}</span>
            <button
              className={styles.btnLogout}
              onClick={() => { localStorage.removeItem('ps_admin'); router.push('/admin/login') }}
            >
              <LogOut size={14} /> 退出
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Tabs */}
        <div className={styles.tabBar}>
          {tabs.map(t => (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
            </button>
          ))}
          <div className={styles.tabSpacer} />
          <button className={styles.btnRefresh} onClick={loadAll} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spinning : ''} />
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>

        {/* ===== Materials Tab ===== */}
        {tab === 'materials' && (
          <div>
            {/* Upload Form - Single */}
            <div className={styles.uploadCard}>
              <h3 className={styles.uploadTitle}>
                <Upload size={15} color="#6366f1" /> 上传素材（单文件）
              </h3>
              <div className={styles.uploadGrid}>
                <input
                  className={styles.input}
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="素材名称 *"
                />
                <input
                  className={styles.input}
                  value={uploadPoints}
                  onChange={e => setUploadPoints(e.target.value)}
                  placeholder="积分价格 *"
                  type="number"
                />
                <input
                  className={styles.input}
                  value={uploadDownloads}
                  onChange={e => setUploadDownloads(e.target.value)}
                  placeholder="下载次数上限（留空=不限）"
                  type="number"
                />
              </div>
              <div className={styles.uploadOptions}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={deleteAfterDownload}
                    onChange={e => setDeleteAfterDownload(e.target.checked)}
                  />
                  <span>用户下载后立即删除（购买后删除）</span>
                </label>
              </div>
              <div className={styles.uploadFooter}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className={styles.fileInput}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (f.size > 1024 * 1024 * 1024) { alert('文件不能超过1GB'); return }
                    setFile(f)
                    if (!uploadName) setUploadName(f.name.replace(/\.[^.]+$/, ''))
                  }}
                />
                <button
                  className={`${styles.btnUpload} ${uploading ? styles.btnDisabled : ''}`}
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading
                    ? <><RefreshCw size={14} className={styles.spinning} /> 上传中...</>
                    : <><Upload size={14} /> 上传</>}
                </button>
                {file && <span className={styles.fileName}>{file.name} ({(file.size/1024/1024).toFixed(1)}MB)</span>}
              </div>
            </div>

            {/* Batch Upload */}
            <div className={styles.uploadCard} style={{ marginTop: 12 }}>
              <h3 className={styles.uploadTitle}>
                <Layers size={15} color="#6366f1" /> 批量上传
              </h3>
              <p className={styles.uploadHint}>同时上传多个视频，积分/次数配置统一适用</p>
              <div className={styles.batchRow}>
                <label className={styles.batchBtn}>
                  <FolderOpen size={14} /> 选择多个视频（最多1GB/个）
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    className={styles.hiddenInput}
                    onChange={handleBatchSelect}
                  />
                </label>
                {batchFiles.length > 0 && (
                  <button
                    className={`${styles.btnUpload} ${batchUploading ? styles.btnDisabled : ''}`}
                    onClick={handleBatchUpload}
                    disabled={batchUploading}
                  >
                    {batchUploading
                      ? <><RefreshCw size={14} className={styles.spinning} /> 上传中...</>
                      : <><Upload size={14} /> 开始上传 {batchFiles.length} 个</>}
                  </button>
                )}
              </div>
              {/* Batch Queue */}
              {batchQueue.length > 0 && (
                <div className={styles.batchList}>
                  {batchQueue.map((item, i) => (
                    <div key={i} className={styles.batchItem}>
                      <span className={styles.batchItemName}>{item.file.name}</span>
                      <span className={styles.batchItemSize}>{(item.file.size/1024/1024).toFixed(1)}MB</span>
                      <span className={item.status === 'done' ? styles.batchDone
                        : item.status === 'error' ? styles.batchError
                        : item.status === 'uploading' ? styles.batchUploading
                        : styles.batchPending}>
                        {item.status === 'done' ? '✅'
                          : item.status === 'error' ? `❌ ${item.msg}`
                          : item.status === 'uploading' ? '⏳ 上传中...'
                          : '⏸️ 等待'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Materials Table */}
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thead}>
                    <th className={styles.th}>素材名称</th>
                    <th className={styles.th}>分类</th>
                    <th className={styles.th}>积分</th>
                    <th className={styles.th}>剩余次数</th>
                    <th className={styles.th}>上传时间</th>
                    <th className={styles.th}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 && (
                    <tr><td colSpan={6} className={styles.empty}>暂无素材，点击上方上传</td></tr>
                  )}
                  {materials.map(mat => (
                    <MaterialRow
                      key={mat.id}
                      mat={mat}
                      isEditing={!!mat._editing}
                      onStartEdit={() => startEdit(mat)}
                      onSave={() => saveEdit(mat)}
                      onDelete={() => handleDelete(mat)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Users Tab ===== */}
        {tab === 'users' && (
          <div>
            {/* Stats */}
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statNum}>{dbUsers.length}</span>
                <span className={styles.statLabel}>总用户数</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNum}>
                  {dbUsers.reduce((s, u) => s + Number(u.points), 0).toLocaleString()}
                </span>
                <span className={styles.statLabel}>积分总流通</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNum}>
                  {dbUsers.filter(u => Number(u.points) > 0).length}
                </span>
                <span className={styles.statLabel}>有积分用户</span>
              </div>
            </div>

            {/* Search */}
            <div className={styles.searchRow}>
              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} />
                <input
                  className={styles.searchInput}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索用户名..."
                  onKeyDown={e => { if (e.key === 'Enter') setSearch((e.target as HTMLInputElement).value) }}
                />
              </div>
              <span className={styles.resultCount}>
                {filteredUsers.length} 个用户
              </span>
            </div>

            {/* Users Table */}
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thead}>
                    <th className={styles.th}>用户名</th>
                    <th className={styles.th}>积分余额</th>
                    <th className={styles.th}>注册时间</th>
                    <th className={styles.th}>积分操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={4} className={styles.empty}>没有找到用户</td></tr>
                  )}
                  {filteredUsers.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onAdjust={delta => handleAdjust(u.id, Number(u.points), delta)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Orders Tab ===== */}
        {tab === 'orders' && (
          <div>
            {/* Stats */}
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statNum}>{orders.length}</span>
                <span className={styles.statLabel}>总订单数</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNum} style={{ color: '#22c55e' }}>
                  {orders.filter(o => o.status === 'completed').length}
                </span>
                <span className={styles.statLabel}>已完成</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNum}>
                  {orders.reduce((s, o) => s + Number(o.points_added), 0).toLocaleString()}
                </span>
                <span className={styles.statLabel}>积分发放总量</span>
              </div>
            </div>

            {/* Orders Table */}
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.thead}>
                    <th className={styles.th}>用户名</th>
                    <th className={styles.th}>积分</th>
                    <th className={styles.th}>USD</th>
                    <th className={styles.th}>状态</th>
                    <th className={styles.th}>时间</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td colSpan={5} className={styles.empty}>暂无充值记录</td></tr>
                  )}
                  {orders.map(o => (
                    <OrderRow key={o.id} order={o} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
