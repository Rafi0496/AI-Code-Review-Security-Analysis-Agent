import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const features = [
  { icon: '🔍', title: 'Code Analysis Agent', desc: 'Detects code smells, complexity issues, poor naming, dead code, and design anti-patterns automatically.' },
  { icon: '🛡️', title: 'Security Vulnerability Agent', desc: 'Scans for OWASP Top 10 vulnerabilities — SQL Injection, XSS, hardcoded secrets, broken access control.' },
  { icon: '🔧', title: 'Remediation Agent', desc: 'Generates specific fix recommendations with corrected code examples grounded in secure coding standards.' },
  { icon: '📋', title: 'PR Summary Agent', desc: 'Compiles all findings into a human-readable pull request review with verdict and risk assessment.' },
  { icon: '💬', title: 'RAG Code Assistant', desc: 'Ask follow-up questions about flagged issues — powered by OWASP and secure coding knowledge base.' },
  { icon: '📊', title: 'Exportable Reports', desc: 'Download structured review reports in Markdown with severity breakdown and remediation roadmap.' },
]

const stats = [
  { value: '4', label: 'Specialized AI Agents' },
  { value: '20+', label: 'OWASP Vulnerabilities Detected' },
  { value: '100%', label: 'Automated Analysis' },
  { value: 'RAG', label: 'Knowledge-Grounded Answers' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="logo-icon">🛡️</div>
          <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>CodeGuard AI</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user ? (
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Open Dashboard →
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
              <button className="btn btn-primary" onClick={() => navigate('/register')}>Get Started Free</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-glow" />
        <div className="hero-badge">
          <span>⚡</span>
          <span>Multi-Agent AI • OWASP Security • RAG-Powered</span>
        </div>
        <h1 className="hero-title">Intelligent Code Review<br />& Security Analysis</h1>
        <p className="hero-subtitle">
          Paste or upload your code and let 4 specialized AI agents analyze quality,
          detect OWASP vulnerabilities, generate fixes, and produce a PR review summary — in seconds.
        </p>
        <div className="hero-ctas">
          <button className="btn btn-primary btn-lg" onClick={() => navigate(user ? '/submit' : '/register')}>
            🚀 Analyze My Code
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/login')}>
            📖 View Demo
          </button>
        </div>
      </section>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', padding: '2rem 3rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        {stats.map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <section>
        <div style={{ textAlign: 'center', padding: '4rem 3rem 2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Everything You Need for <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Secure Code</span></h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto' }}>
            A complete multi-agent AI pipeline that covers every aspect of code quality and security.
          </p>
        </div>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} className="feature-card animate-fade-in">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section style={{ padding: '5rem 3rem', textAlign: 'center' }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-xl)',
          padding: '3rem',
          maxWidth: 700,
          margin: '0 auto',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <h2 style={{ marginBottom: '1rem' }}>Start Your First Review</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            No setup required. Paste your Python or Java code and get a full AI security and quality analysis.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate(user ? '/submit' : '/register')}>
            🛡️ Analyze Code Now — It's Free
          </button>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '1.5rem 3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        © 2025 CodeGuard AI — AI Code Review & Security Analysis Agent | Academic Capstone Project
      </footer>
    </div>
  )
}
