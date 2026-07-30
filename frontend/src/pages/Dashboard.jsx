import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { reviewsAPI } from '../api/client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
}

function SeverityDonut({ stats }) {
  const data = [
    { name: 'Critical', value: stats.critical_count || 0, color: SEVERITY_COLORS.critical },
    { name: 'High', value: stats.high_count || 0, color: SEVERITY_COLORS.high },
    { name: 'Medium', value: stats.medium_count || 0, color: SEVERITY_COLORS.medium },
    { name: 'Low', value: stats.low_count || 0, color: SEVERITY_COLORS.low },
    { name: 'Info', value: stats.info_count || 0, color: SEVERITY_COLORS.info },
  ].filter(d => d.value > 0)

  if (data.length === 0) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No findings yet</div>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
          {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reviewsAPI.list()
      .then(res => setReviews(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalFindings = reviews.reduce((s, r) => s + r.total_findings, 0)
  const totalCritical = reviews.reduce((s, r) => s + r.critical_count, 0)
  const totalHigh = reviews.reduce((s, r) => s + r.high_count, 0)
  const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.overall_score, 0) / reviews.length) : 0

  const aggregateStats = {
    critical_count: reviews.reduce((s, r) => s + r.critical_count, 0),
    high_count: reviews.reduce((s, r) => s + r.high_count, 0),
    medium_count: reviews.reduce((s, r) => s + r.medium_count, 0),
    low_count: reviews.reduce((s, r) => s + r.low_count, 0),
    info_count: reviews.reduce((s, r) => s + r.info_count, 0),
  }

  const getSeverityBadge = (r) => {
    if (r.critical_count > 0) return <span className="badge badge-critical">🔴 Critical</span>
    if (r.high_count > 0) return <span className="badge badge-high">🟠 High Risk</span>
    if (r.medium_count > 0) return <span className="badge badge-medium">🟡 Medium Risk</span>
    return <span className="badge badge-low">🟢 Low Risk</span>
  }

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <h1 style={{ fontSize: '1.875rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{user?.full_name || user?.username}</strong> · {user?.role}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/submit')}>
          ➕ New Review
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Reviews</div>
          <div className="stat-value">{reviews.length}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Findings</div>
          <div className="stat-value" style={{ color: 'var(--severity-high)' }}>{totalFindings}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Across all reviews</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Critical Issues</div>
          <div className="stat-value" style={{ color: 'var(--severity-critical)' }}>{totalCritical}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Requires immediate action</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Quality Score</div>
          <div className="stat-value" style={{ color: 'var(--severity-low)' }}>{avgScore}/100</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Code quality rating</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {/* Severity Chart */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>📊 Severity Distribution</h3>
          <SeverityDonut stats={aggregateStats} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem', justifyContent: 'center' }}>
            {Object.entries(SEVERITY_COLORS).map(([k, c]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>⚡ Quick Actions</h3>
          {[
            { icon: '🔍', label: 'Submit Code for Review', desc: 'Paste or upload source code', action: () => navigate('/submit') },
            { icon: '💬', label: 'Ask AI Assistant', desc: 'Get answers about security and code quality', action: () => navigate('/chat') },
            { icon: '📋', label: 'View All Reviews', desc: 'Browse previous analysis results', action: () => navigate('/reviews') },
          ].map(item => (
            <button key={item.label} className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '0.875rem 1rem', height: 'auto', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem' }} onClick={item.action}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <span>{item.icon}</span>{item.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem' }}>🕒 Recent Reviews</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reviews')}>View All →</button>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 200 }}><div className="spinner" /></div>
        ) : reviews.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No reviews yet</h3>
            <p>Submit your first code for analysis</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/submit')}>Submit Code</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Review ID</th>
                  <th>Risk Level</th>
                  <th>Findings</th>
                  <th>Quality Score</th>
                  <th>Time</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reviews.slice(0, 10).map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.id.slice(0, 8)}…</td>
                    <td>{getSeverityBadge(r)}</td>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{r.total_findings}</strong></td>
                    <td>
                      <span style={{ color: r.overall_score >= 70 ? 'var(--severity-low)' : r.overall_score >= 40 ? 'var(--severity-medium)' : 'var(--severity-critical)', fontWeight: 600 }}>
                        {r.overall_score?.toFixed(0)}/100
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.processing_time_seconds?.toFixed(1)}s</td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/review/${r.id}`)}>View →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
