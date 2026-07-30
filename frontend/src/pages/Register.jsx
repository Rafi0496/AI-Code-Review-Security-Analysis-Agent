import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ email: '', username: '', password: '', full_name: '', role: 'developer' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <div className="auth-card animate-fade-in">
        <div className="auth-logo">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join CodeGuard AI</p>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="full_name">Full Name</label>
            <input id="full_name" type="text" className="input" placeholder="Jane Smith" value={form.full_name} onChange={set('full_name')} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input id="username" type="text" className="input" placeholder="janesmith" value={form.username} onChange={set('username')} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email Address</label>
            <input id="reg-email" type="email" className="input" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input id="reg-password" type="password" className="input" placeholder="At least 6 characters" value={form.password} onChange={set('password')} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="role">Role</label>
            <select id="role" className="select" value={form.role} onChange={set('role')}>
              <option value="developer">Developer</option>
              <option value="reviewer">Reviewer</option>
            </select>
          </div>
          <button
            type="submit"
            className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {!loading && '🚀 Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-primary)' }}>Sign in →</Link>
        </div>
      </div>
    </div>
  )
}
