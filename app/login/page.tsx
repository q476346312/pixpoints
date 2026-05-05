'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

// 关闭开放注册，仅保留登录功能
const ALLOW_REGISTRATION = true
type Tab = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('ps_last_username') || ''
    if (saved) { setUsername(saved); setRemember(true) }
    setMounted(true)
  }, [])

  function switchTab(t: Tab) {
    setTab(t)
    setError('')
    setSuccess('')
    setPassword('')
    setConfirmPwd('')
  }

  async function handleRegister() {
    setError('')
    setSuccess('')
    if (!username.trim()) return setError('请输入账号')
    if (username.length < 3) return setError('账号至少3个字符')
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return setError('账号只能包含字母、数字、下划线')
    if (!password) return setError('请输入密码')
    if (password.length < 6) return setError('密码至少6位')
    if (password !== confirmPwd) return setError('两次密码不一致')

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      setSuccess('注册成功！请登录')
      setPassword('')
      setConfirmPwd('')
      setTab('login')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    setError('')
    if (!username.trim()) return setError('请输入账号')
    if (!password) return setError('请输入密码')

    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      localStorage.setItem('ps_user', JSON.stringify(data.user))
      if (remember) { localStorage.setItem('ps_last_username', username.trim()) } else { localStorage.removeItem('ps_last_username') }
      router.push('/')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (tab === 'login') handleLogin()
      else handleRegister()
    }
  }

  return (
    <div className={styles.pageRoot}>
      <div className={styles.bgGlow} />
      <div className={styles.bgGrid} />

      <div className={styles.mainCard}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>PP</div>
          <h1 className={styles.logoTitle}>PixPoints</h1>
          <p className={styles.logoSub}>每一次下载都是独一无二的数字资产</p>
        </div>

        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${tab === 'login' ? styles.tabBtnActive : ''}`}
            onClick={() => switchTab('login')}
          >
            登录
          </button>
          {ALLOW_REGISTRATION && (
            <button
              className={`${styles.tabBtn} ${tab === 'register' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('register')}
            >
              注册
            </button>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>账号</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>👤</span>
            <input
              type="text"
              placeholder="3位以上，字母/数字/下划线"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="username"
            />
          </div>
          {tab === 'register' && !username && (
            <p className={styles.fieldHint}>字母、数字、下划线组合，3位以上</p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>密码</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>🔒</span>
            <input
              type={showPwd ? 'text' : 'password'}
              placeholder={tab === 'register' ? '至少6位' : '输入密码'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              className={styles.eyeBtn}
              onClick={() => setShowPwd(v => !v)}
              type="button"
            >
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {tab === 'register' && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>确认密码</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="再次输入密码"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        {error && (
          <div className={`${styles.alert} ${styles.alertError}`}>
            <span>⚠️</span> {error}
          </div>
        )}

        {success && (
          <div className={`${styles.alert} ${styles.alertSuccess}`}>
            <span>✅</span> {success}
          </div>
        )}

                {tab === 'login' && mounted && (
          <label className={styles.rememberLabel}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
            <span>记住我</span>
          </label>
        )}
        <button
          className={`${styles.submitBtn} ${loading ? styles.submitBtnLoading : ''}`}
          onClick={tab === 'login' ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading ? (
            <span className={styles.spinner} />
          ) : (
            <>
              {tab === 'login' ? '登录' : '注册'}
              <span className={styles.arrow}>→</span>
            </>
          )}
        </button>

        <p className={styles.footerNote}>
          {tab === 'login' ? '还没有账号？' : '已有账号？'}
          <button onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}>
            {tab === 'login' ? '立即注册' : '直接登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
