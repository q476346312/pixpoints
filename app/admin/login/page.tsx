'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../admin.module.css'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    // 如果已经登录了管理员，直接跳转
    const raw = localStorage.getItem('ps_admin')
    if (raw) {
      const admin = JSON.parse(raw)
      if (admin.username === 'admin') {
        router.push('/admin')
        return
      }
    }
  }, [])

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError('请输入账号和密码')
      return
    }
    setError('')
    setLoading(true)

    // 从环境变量读取管理员凭证
    const ADMIN_USER = process.env.NEXT_PUBLIC_ADMIN_USER!
    const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS!

    // 简单延迟模拟验证
    await new Promise(r => setTimeout(r, 600))

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      localStorage.setItem('ps_admin', JSON.stringify({ username: 'admin', loginAt: Date.now() }))
      router.push('/admin')
    } else {
      setError('账号或密码错误')
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginBox}>
        <div className={styles.loginHeader}>
          <span className={styles.loginLogo}>PP</span>
          <h1 className={styles.loginTitle}>PixPoints</h1>
          <p className={styles.loginSub}>管理后台入口</p>
        </div>

        <div className={styles.loginForm}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel}>管理员账号</label>
            <input
              className={styles.loginInput}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入管理员账号"
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className={styles.loginField}>
            <label className={styles.loginLabel}>密码</label>
            <div className={styles.loginPwWrap}>
              <input
                className={styles.loginInput}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="请输入密码"
                autoComplete="off"
              />
              <button
                className={styles.loginPwToggle}
                onClick={() => setShowPw(v => !v)}
                type="button"
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.loginError}>{error}</div>
          )}

          <button
            className={styles.loginBtn}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? '验证中...' : '进入后台'}
          </button>
        </div>

        <div className={styles.loginFooter}>
          <a href="/login" className={styles.loginLink}>← 返回用户登录</a>
        </div>
      </div>
    </div>
  )
}
