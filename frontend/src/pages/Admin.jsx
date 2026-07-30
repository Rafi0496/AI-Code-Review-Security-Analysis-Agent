import { useState, useEffect } from 'react'
import { adminAPI } from '../api/client'

export default function Admin() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([adminAPI.stats(), adminAPI.users()])
      .then(([sRes, uRes]) => { setStats(sRes.data); setUsers(uRes.data) })
      .finally(() => setLoading(false))
  }, [])

  const updateUser = async (id, data) => {
    setUpdating(id)
    try {
      const res = await adminAPI.updateUser(id, data)
      setUsers(u => u.map(user => user.id === id ? { ...user, ...res.data } : user))
      setMessage('User updated successfully')
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      setMessage('Update failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setUpdating(null) }
  }

  if (loading) return <div className="page-content"><div className="loading-screen"><div className="spinner" /><p>Loading admin panel…</p></div></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>⚙️ Administration</h1>
        <p>Manage users, view system statistics, and monitor agent health</p>
      </div>

      {message && <div className={`alert ${message.includes('failed') ? 'alert-error' : 'alert-success'}`}>{message}</div>}

      {/* System Stats */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: '2rem' }}>
          {[
            { label: 'Total Users', value: stats.total_users, icon: '👥' },
            { label: 'Total Reviews', value: stats.total_reviews, icon: '🔍' },
            { label: 'Total Submissions', value: stats.total_submissions, icon: '📤' },
            { label: 'Total Findings', value: stats.total_findings, icon: '⚠️' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Status */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>🤖 Agent Health</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {[
            { name: 'Code Analysis Agent', status: 'online' },
            { name: 'Security Agent', status: 'online' },
            { name: 'Remediation Agent', status: 'online' },
            { name: 'PR Summary Agent', status: 'online' },
            { name: 'RAG Chat Agent', status: 'online' },
          ].map(agent => (
            <div key={agent.name} style={{ padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{agent.name}</span>
              <span className="badge badge-low" style={{ fontSize: '0.65rem' }}>● Online</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Management */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>👥 User Management</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name || u.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{u.username}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{u.email}</td>
                  <td>
                    <select
                      className="select"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
                      value={u.role}
                      onChange={e => updateUser(u.id, { role: e.target.value })}
                      disabled={updating === u.id}
                    >
                      <option value="developer">Developer</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-low' : 'badge-critical'}`}>
                      {u.is_active ? '● Active' : '● Disabled'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                      disabled={updating === u.id}
                    >
                      {updating === u.id ? '…' : u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
