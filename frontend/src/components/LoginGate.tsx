import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { authApi, clearAuth, getStoredAuth, storeAuth } from '../api'

interface LoginGateProps {
  children: (auth: { username: string; onLogout: () => void }) => ReactNode
}

export default function LoginGate({ children }: LoginGateProps) {
  const [username, setUsername] = useState(getStoredAuth().username)
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(Boolean(getStoredAuth().token))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const { token } = getStoredAuth()
    if (!token) {
      setLoading(false)
      return
    }

    authApi.me()
      .then(res => setUsername(res.username))
      .catch(() => {
        clearAuth()
        setUsername('')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await authApi.login(loginName.trim(), password)
      storeAuth(res.token, res.username)
      setUsername(res.username)
      setLoginName('')
      setPassword('')
    } catch (err) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(axiosErr.response?.data?.detail || axiosErr.message || '登录失败，请检查账号和密码')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    setUsername('')
  }

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="auth-panel auth-loading">正在验证登录状态...</div>
      </div>
    )
  }

  if (username) {
    return <>{children({ username, onLogout: handleLogout })}</>
  }

  return (
    <div className="auth-shell">
      <main className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden="true">AI</span>
          <div>
            <h1 id="login-title">超级考公 2.0</h1>
            <p>请输入授权账号继续使用</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            <span>账号</span>
            <input
              autoComplete="username"
              value={loginName}
              onChange={event => setLoginName(event.target.value)}
              required
            />
          </label>

          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>
      </main>
    </div>
  )
}
