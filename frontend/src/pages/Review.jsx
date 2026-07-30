import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reviewsAPI, reportsAPI } from '../api/client'

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

function SeverityBadge({ severity }) {
  return <span className={`badge badge-${severity}`}>{severity.toUpperCase()}</span>
}

function FindingCard({ finding }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="finding-card">
      <div className="finding-header" onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <SeverityBadge severity={finding.severity} />
          <span className="finding-title">{finding.title}</span>
        </div>
        <div className="finding-meta">
          {finding.owasp_category && (
            <span className="badge badge-security" style={{ fontSize: '0.65rem' }}>{finding.owasp_category}</span>
          )}
          {finding.agent_type === 'security' ? (
            <span className="badge badge-security" style={{ fontSize: '0.65rem' }}>🛡️ Security</span>
          ) : (
            <span className="badge badge-code" style={{ fontSize: '0.65rem' }}>🔍 Quality</span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && (
        <div className="finding-body animate-fade-in">
          <p className="finding-description">{finding.description}</p>
          {finding.line_number && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              📍 Line {finding.line_number}
            </div>
          )}
          {finding.code_example && (
            <div className="code-block">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Affected Code:</div>
              <pre>{finding.code_example}</pre>
            </div>
          )}
          {finding.recommendation && (
            <div className="finding-recommendation">
              <strong>💡 Recommendation</strong>
              {finding.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RemediationCard({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="finding-card">
      <div className="finding-header" onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <SeverityBadge severity={item.severity} />
          <span className="finding-title">{item.finding_title}</span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="finding-body animate-fade-in">
          <p className="finding-description">{item.explanation}</p>
          {item.before_code && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--severity-critical)', marginBottom: '0.35rem' }}>❌ Before (Vulnerable):</div>
              <div className="code-block" style={{ borderColor: 'rgba(239,68,68,0.2)' }}><pre>{item.before_code}</pre></div>
            </div>
          )}
          {item.after_code && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--severity-low)', marginBottom: '0.35rem' }}>✅ After (Fixed):</div>
              <div className="code-block" style={{ borderColor: 'rgba(34,197,94,0.2)' }}><pre>{item.after_code}</pre></div>
            </div>
          )}
          {item.best_practice && (
            <div className="finding-recommendation" style={{ marginTop: '0.75rem' }}>
              <strong>📚 Best Practice</strong>
              {item.best_practice}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Review() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    reviewsAPI.get(id).then(res => setReview(res.data)).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const downloadMarkdown = async () => {
    setDownloading(true)
    try {
      const res = await reportsAPI.markdown(id)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `review_${id.slice(0, 8)}.md`
      a.click(); URL.revokeObjectURL(url)
    } catch (e) {} finally { setDownloading(false) }
  }

  if (loading) return <div className="page-content"><div className="loading-screen"><div className="spinner" /><p>Loading review…</p></div></div>
  if (!review) return <div className="page-content"><div className="alert alert-error">Review not found</div></div>

  const { stats, code_analysis, security_analysis, remediation, pr_summary, findings } = review
  const sortedFindings = [...findings].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  const verdict = pr_summary?.verdict || 'Changes Required'
  const verdictClass = verdict === 'Approved' ? 'verdict-approved' : verdict === 'Rejected' ? 'verdict-rejected' : 'verdict-changes'

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-title-row">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')} style={{ marginBottom: '0.5rem' }}>← Back</button>
          <h1 style={{ fontSize: '1.5rem' }}>Code Review Results</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>Review {id.slice(0, 8)}…</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/chat?review=${id}`)}>💬 Ask AI</button>
          <button className={`btn btn-secondary btn-sm ${downloading ? 'btn-loading' : ''}`} onClick={downloadMarkdown} disabled={downloading}>
            {!downloading && '⬇️ Export Markdown'}
          </button>
        </div>
      </div>

      {/* Verdict Banner */}
      <div className="verdict-banner">
        <div className="verdict-icon">{verdict === 'Approved' ? '✅' : verdict === 'Rejected' ? '🚫' : '⚠️'}</div>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>REVIEW VERDICT</div>
          <div className={`verdict-label ${verdictClass}`}>{verdict}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{pr_summary?.verdict_reason}</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.5rem' }}>
        {[
          { label: 'Quality Score', value: `${stats.overall_score?.toFixed(0)}/100`, color: stats.overall_score >= 70 ? 'var(--severity-low)' : 'var(--severity-medium)' },
          { label: 'Critical', value: stats.critical_count, color: 'var(--severity-critical)' },
          { label: 'High', value: stats.high_count, color: 'var(--severity-high)' },
          { label: 'Medium', value: stats.medium_count, color: 'var(--severity-medium)' },
          { label: 'Total Findings', value: stats.total_findings, color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem', gap: '0.25rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'findings', label: `🔍 Findings (${sortedFindings.length})` },
          { id: 'security', label: `🛡️ Security (${security_analysis?.vulnerabilities?.length || 0})` },
          { id: 'remediation', label: '🔧 Remediation' },
          { id: 'prsummary', label: '📋 PR Summary' },
        ].map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in">
          <div className="grid-2">
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>📊 Code Analysis Summary</h3>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>MAINTAINABILITY</div>
                <span className="badge badge-info">{code_analysis?.maintainability_rating || 'N/A'}</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{code_analysis?.summary}</p>
              {code_analysis?.positive_aspects?.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>✅ POSITIVE ASPECTS</div>
                  {code_analysis.positive_aspects.map((p, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--severity-low)', marginBottom: '0.25rem' }}>• {p}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>🛡️ Security Summary</h3>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>RISK LEVEL</div>
                <span className={`badge badge-${security_analysis?.risk_level === 'Critical' ? 'critical' : security_analysis?.risk_level === 'High' ? 'high' : 'medium'}`}>
                  {security_analysis?.risk_level || 'N/A'}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{security_analysis?.security_summary}</p>
              {security_analysis?.critical_actions?.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--severity-critical)', marginBottom: '0.5rem' }}>⚡ CRITICAL ACTIONS</div>
                  {security_analysis.critical_actions.map((a, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>• {a}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {code_analysis?.top_recommendations?.length > 0 && (
            <div className="card" style={{ marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>💡 Top Recommendations</h3>
              {code_analysis.top_recommendations.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '1.1rem' }}>{i + 1}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="animate-fade-in">
          {sortedFindings.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><h3>No findings detected</h3><p>Great job — no issues were found!</p></div>
          ) : (
            sortedFindings.map(f => <FindingCard key={f.id} finding={f} />)
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="animate-fade-in">
          {(security_analysis?.vulnerabilities || []).length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🛡️</div><h3>No vulnerabilities detected</h3><p>Code appears secure!</p></div>
          ) : (
            (security_analysis.vulnerabilities || []).map((v, i) => (
              <FindingCard key={i} finding={{ ...v, agent_type: 'security', title: v.title, description: v.description, code_example: v.affected_code }} />
            ))
          )}
        </div>
      )}

      {activeTab === 'remediation' && (
        <div className="animate-fade-in">
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STRATEGY</div><p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{remediation?.remediation_summary}</p></div>
              <div style={{ flexShrink: 0 }}><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EFFORT</div><span className="badge badge-medium" style={{ marginTop: '0.25rem', display: 'inline-flex' }}>{remediation?.effort_estimate}</span></div>
            </div>
          </div>
          {(remediation?.remediations || []).map((r, i) => <RemediationCard key={i} item={r} />)}
          {remediation?.refactoring_roadmap?.length > 0 && (
            <div className="card" style={{ marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>🗺️ Refactoring Roadmap</h3>
              {remediation.refactoring_roadmap.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{step.priority}</div>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 500 }}>{step.action}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>⏱️ {step.estimated_effort}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prsummary' && (
        <div className="animate-fade-in">
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>📋 {pr_summary?.pr_title}</h3>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FIX TIME</span><div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{pr_summary?.estimated_fix_time}</div></div>
              <div><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DEPLOY READY</span><div style={{ marginTop: '0.25rem' }}><span className={`badge ${pr_summary?.risk_assessment?.deployment_ready ? 'badge-low' : 'badge-critical'}`}>{pr_summary?.risk_assessment?.deployment_ready ? '✅ Yes' : '🚫 No'}</span></div></div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.8 }}>{pr_summary?.executive_summary}</p>
          </div>
          {pr_summary?.key_issues?.length > 0 && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>⚡ Key Issues</h3>
              {pr_summary.key_issues.map((issue, i) => (
                <div key={i} style={{ padding: '0.875rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem', borderLeft: '3px solid var(--severity-high)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>#{issue.priority} {issue.issue}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{issue.impact}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '0.35rem' }}>→ {issue.action_required}</div>
                </div>
              ))}
            </div>
          )}
          {pr_summary?.commendations?.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>👍 Commendations</h3>
              {pr_summary.commendations.map((c, i) => (
                <div key={i} style={{ fontSize: '0.875rem', color: 'var(--severity-low)', marginBottom: '0.5rem' }}>✅ {c}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
