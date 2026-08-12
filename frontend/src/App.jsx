import { useState, useEffect, useRef, useCallback } from 'react'
import './styles/index.css'
import { api } from './api/client'

// ── SVG Icon library ────────────────────────────────────────────
const Icon = {
  Shield: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Play: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  MessageSquare: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Code: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Upload: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  ),
  File: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
    </svg>
  ),
  Download: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  Send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  AlertCircle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
  Clipboard: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  ),
  Lock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Cpu: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/>
      <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
      <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
      <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
      <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  GitMerge: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>
    </svg>
  ),
  FileText: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  User: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Bot: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  Wifi: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  ),
  WifiOff: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  ),
  Wrench: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
}

// ── Helpers ──────────────────────────────────────────────────────
const SEV_CLS = { Critical: 'c', High: 'h', Medium: 'm', Low: 'l' }
const sevCls = (s) => SEV_CLS[s] ?? 'l'
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const detectLanguage = (code) => {
  if (!code) return 'python'
  if (/public\s+class\s+/.test(code) || /import\s+java\./.test(code) || /System\.out\.println/.test(code)) {
    return 'java'
  }
  return 'python'
}

// ── Sample vulnerable code ────────────────────────────────────────
const SAMPLE_CODE = `import sqlite3
import os

# Hardcoded credentials — OWASP A07
API_KEY = "sk-prod-abc123xyz789"
DB_PASSWORD = "admin123"

# SQL Injection — OWASP A03
def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    query = "SELECT * FROM users WHERE name='" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()

# Command Injection — OWASP A03
def ping_host(host):
    cmd = "ping " + host
    os.system(cmd)

# Bare except — code smell
def risky_divide(value):
    try:
        return 100 / int(value)
    except:
        return None

# Too many parameters — code smell
def process(a, b, c, d, e, f, g):
    pass
`

// ── Toast ────────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className={`toast ${type === 'err' ? 'toast-err' : 'toast-ok'}`}>
      <span className="toast-icon">
        {type === 'err' ? <Icon.AlertCircle /> : <Icon.CheckCircle />}
      </span>
      <span className="toast-msg">{msg}</span>
      <button className="toast-close" onClick={onClose} aria-label="Dismiss">
        <Icon.X />
      </button>
    </div>
  )
}

// ── Code Health Score Gauge ─────────────────────────────────────
function HealthGauge({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  const offset = circumference - (animatedScore / 100) * circumference
  const color = score <= 40 ? 'var(--sev-c)' : score <= 70 ? 'var(--amber)' : 'var(--emerald)'
  const label = score <= 40 ? 'Poor' : score <= 70 ? 'Fair' : 'Good'

  return (
    <div className="health-gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease' }}
        />
      </svg>
      <div className="health-gauge-center">
        <div className="health-gauge-score" style={{ color }}>{animatedScore}</div>
        <div className="health-gauge-label">{label}</div>
      </div>
      <div className="health-gauge-title">Code Health Score</div>
    </div>
  )
}

// ── Finding card with Remediation ────────────────────────────────
function FindingCard({ finding, idx, code, language }) {
  const [open, setOpen] = useState(false)
  const [fix, setFix] = useState(null)
  const [fixLoading, setFixLoading] = useState(false)
  const cls = sevCls(finding.severity)

  const loadFix = async (e) => {
    e.stopPropagation()
    if (fix || fixLoading) return
    setFixLoading(true)
    try {
      const data = await api.remediate(finding, code, language)
      setFix(data)
    } catch (err) {
      setFix({ fix_summary: 'Could not load fix: ' + err.message, before_code: '', after_code: '', best_practice: '', owasp_reference: '' })
    } finally {
      setFixLoading(false)
    }
  }

  return (
    <div
      className={`vuln-card border-l-${cls}`}
      style={{ animationDelay: `${Math.min(idx * 0.06, 0.8)}s` }}
    >
      <div className="vuln-card-header" onClick={() => setOpen(o => !o)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}>
        <div className="finding-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`sev-badge sev-badge-${cls}`}>{finding.severity}</span>
          <div className="finding-name" style={{ flex: 1, fontWeight: 'bold' }}>{finding.type}</div>
          {finding.line > 0 && (
            <span className="line-num">Line {finding.line}</span>
          )}
        </div>
      </div>
      <div className="vuln-desc" style={{ padding: '0 1rem 1rem' }}>{finding.description}</div>

      {open && (
        <div className="vuln-body" style={{ padding: '0 1rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          {finding.owasp && (
            <div style={{ marginBottom: '0.6rem' }}>
              <span className="chip chip-cat">{finding.owasp}</span>
            </div>
          )}
          {finding.recommendation && (
            <div className="vuln-rec" style={{ marginBottom: '1rem', color: 'var(--text-2)' }}>
              <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Recommendation</span>
              {finding.recommendation}
            </div>
          )}

          {/* Remediation Agent Section */}
          {!fix && (
            <button className="view-fix-btn" onClick={loadFix} disabled={fixLoading} style={{ background: 'rgba(128,131,255,0.1)', color: '#c0c1ff', border: '1px solid rgba(128,131,255,0.3)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {fixLoading ? (
                <><span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} /> Loading Fix...</>
              ) : (
                <><Icon.Wrench /> View Fix →</>
              )}
            </button>
          )}

          {fix && (
            <div className="remediation-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="remediation-header" style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon.Wrench /> Remediation Agent
                {fix.owasp_reference && <span className="chip chip-cat" style={{ marginLeft: 'auto' }}>{fix.owasp_reference}</span>}
              </div>
              <div className="remediation-summary" style={{ marginBottom: '1rem' }}>{fix.fix_summary}</div>

              {(fix.before_code || fix.after_code) && (
                <div className="diff-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="diff-panel diff-before">
                    <div className="diff-label" style={{ color: 'var(--sev-c)' }}>Before (Vulnerable)</div>
                    <pre className="diff-code" style={{ background: 'rgba(255,0,0,0.05)', padding: '0.5rem', borderRadius: '4px', overflowX: 'auto' }}>{fix.before_code || '—'}</pre>
                  </div>
                  <div className="diff-panel diff-after">
                    <div className="diff-label" style={{ color: 'var(--emerald)' }}>After (Fixed)</div>
                    <pre className="diff-code" style={{ background: 'rgba(0,255,0,0.05)', padding: '0.5rem', borderRadius: '4px', overflowX: 'auto' }}>{fix.after_code || '—'}</pre>
                  </div>
                </div>
              )}

              {fix.best_practice && (
                <div className="remediation-practice" style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                  <span className="remediation-practice-label" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Best Practice</span>
                  {fix.best_practice}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Agent progress step ───────────────────────────────────────────
const STEPS = [
  { key: 'submission', Icon: Icon.Clipboard, text: 'Validating submission' },
  { key: 'code',       Icon: Icon.Code,      text: 'Code Analysis Agent' },
  { key: 'security',   Icon: Icon.Lock,      text: 'Security Vulnerability Agent' },
  { key: 'merging',    Icon: Icon.GitMerge,  text: 'Orchestrator merging results' },
]
const STEP_ORDER = STEPS.map(s => s.key)

// ── ANALYZE TAB ──────────────────────────────────────────────────
function AnalyzeTab({ onResult, onTabSwitch, setAnalyzing, progress, setProgress }) {
  const [code, setCode] = useState('')
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('paste')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const runAnalysis = useCallback(async () => {
    if (mode === 'paste' && !code.trim()) return
    if (mode === 'file' && !file) return

    setLoading(true)
    setAnalyzing(true)
    setProgress('submission')

    try {
      await delay(350)
      setProgress('code')
      await delay(550)
      setProgress('security')

      let result
      if (mode === 'file') {
        result = await api.analyzeFile(file)
      } else {
        const detectedLang = detectLanguage(code)
        result = await api.analyzeText(code, detectedLang)
      }

      setProgress('merging')
      await delay(300)

      // Attach the submitted code and language for downstream use
      result._submittedCode = mode === 'file' ? '' : code
      result._submittedLanguage = result.submission?.language || detectLanguage(code)

      onResult(result)
      onTabSwitch('results')
    } catch (err) {
      onResult(null, err.message)
    } finally {
      setLoading(false)
      setAnalyzing(false)
      setProgress(null)
    }
  }, [code, file, mode, onResult, onTabSwitch, setAnalyzing, setProgress])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setMode('file') }
  }

  const loadSample = () => {
    setMode('paste')
    setCode(SAMPLE_CODE)
  }

  const canRun = mode === 'paste' ? code.trim().length > 0 : !!file

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="terminal-panel glass-panel">
        <div className="terminal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="traffic-lights" style={{ display: 'flex', gap: '6px' }}>
            <span className="tl-red" style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }}/>
            <span className="tl-yellow" style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f59e0b' }}/>
            <span className="tl-green" style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981' }}/>
          </div>
          <div className="terminal-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => setMode('paste')} style={{ color: mode === 'paste' ? '#c0c1ff' : '#908fa0', background: 'transparent', border: 'none', cursor: 'pointer' }}>Paste Code</button>
            <button onClick={() => setMode('file')} style={{ color: mode === 'file' ? '#c0c1ff' : '#908fa0', background: 'transparent', border: 'none', cursor: 'pointer' }}>Upload File</button>
            {mode === 'paste' && <button onClick={loadSample} style={{ color: '#908fa0', background: 'transparent', border: 'none', cursor: 'pointer' }}>Load Sample</button>}
          </div>
        </div>
        
        {mode === 'paste' ? (
          <div className="terminal-body" style={{ display: 'flex', minHeight: '300px', background: 'rgba(0,0,0,0.2)' }}>
            <div className="line-numbers" style={{ padding: '1rem 0.5rem', color: '#464554', textAlign: 'right', userSelect: 'none', minWidth: '40px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea 
              className="code-textarea" 
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="// Paste your source code here..."
              spellCheck={false}
              autoComplete="off"
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#e4e1ed', padding: '1rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', resize: 'vertical', outline: 'none' }}
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const s = e.target.selectionStart
                  const end = e.target.selectionEnd
                  setCode(c => c.slice(0, s) + '    ' + c.slice(end))
                  setTimeout(() => e.target.setSelectionRange(s + 4, s + 4), 0)
                }
              }}
            />
          </div>
        ) : (
          <div 
            className="terminal-body" 
            style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', border: dragOver ? '2px dashed #8083ff' : '2px dashed rgba(255,255,255,0.1)', margin: '1rem', borderRadius: '8px' }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }}
            />
            {file ? (
              <>
                <Icon.File />
                <div style={{ marginTop: '1rem' }}>{file.name}</div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); setMode('paste'); }} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Remove File</button>
              </>
            ) : (
              <>
                <Icon.Upload />
                <div style={{ marginTop: '1rem' }}>Drop your source file here</div>
                <div style={{ color: '#908fa0', fontSize: '0.875rem' }}>or click to browse</div>
              </>
            )}
          </div>
        )}

        <div className="terminal-footer" style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button className="sentinel-run-btn" onClick={runAnalysis} disabled={loading || !canRun} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#8083ff', color: '#1000a9', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: 'bold', cursor: canRun ? 'pointer' : 'not-allowed', opacity: canRun ? 1 : 0.5 }}>
            {loading ? <span className="spin" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Icon.Play/>} {loading ? 'Running...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      <div className="feature-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div className="feature-card glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#c0c1ff', fontWeight: 'bold' }}>
            <Icon.Cpu /> Multi-Agent Pipeline
          </div>
          <div style={{ color: '#c7c4d7', fontSize: '0.875rem', lineHeight: '1.5' }}>
            Two specialized AI agents run in parallel — Code Analysis Agent and Security Vulnerability Agent — then merged by the Orchestrator.
          </div>
        </div>
        <div className="feature-card glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#c0c1ff', fontWeight: 'bold' }}>
            <Icon.Shield /> OWASP Top 10
          </div>
          <div style={{ color: '#c7c4d7', fontSize: '0.875rem', lineHeight: '1.5' }}>
            Detects SQL Injection, XSS, CSRF, Command Injection, Path Traversal, Hardcoded Secrets, and Broken Access Control.
          </div>
        </div>
        <div className="feature-card glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#c0c1ff', fontWeight: 'bold' }}>
            <Icon.Wrench /> Smart Remediation
          </div>
          <div style={{ color: '#c7c4d7', fontSize: '0.875rem', lineHeight: '1.5' }}>
            Provides context-aware code fixes and automated PR generation to resolve vulnerabilities efficiently.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PR Summary PDF Generator (Full Analytics) ──────────────────
function downloadPDF(prData) {
  // Build detailed findings table rows
  const findingsRows = (prData.detailed_findings || prData.prioritized_fix_list || []).map((f, i) => {
    if (typeof f === 'string') return `<tr><td>${i+1}</td><td>${f}</td><td>—</td><td>—</td><td>—</td></tr>`
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${f.type || 'Issue'}</strong></td>
      <td style="text-align:center">${f.severity || '—'}</td>
      <td style="text-align:center">${f.line || '—'}</td>
      <td>${f.description || '—'}</td>
    </tr>`
  }).join('')

  const recommendationRows = (prData.detailed_findings || prData.prioritized_fix_list || []).map((f, i) => {
    if (typeof f === 'string') return ''
    if (!f.recommendation) return ''
    return `<tr><td><strong>${f.type || 'Issue'}</strong> (Line ${f.line || '?'})</td><td>${f.recommendation}</td></tr>`
  }).filter(Boolean).join('')

  const criticalList = (prData.top_critical_findings || []).map(f => {
    if (typeof f === 'string') return `<li>${f}</li>`
    return `<li><strong>${f.type || 'Issue'}</strong> (Line ${f.line || '?'}): ${f.impact || f.description || '—'}</li>`
  }).join('')

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Code Review Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: #1a1a1a; padding: 48px; line-height: 1.7; font-size: 13px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
  h2 { font-size: 16px; font-weight: 700; margin: 28px 0 10px; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
  p { margin-bottom: 10px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 24px; }
  .score-row { display: flex; gap: 32px; margin: 16px 0 24px; padding: 16px; background: #f8f8f8; border-radius: 6px; }
  .score-item { display: flex; flex-direction: column; }
  .score-val { font-size: 28px; font-weight: 700; color: #111; }
  .score-lbl { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { text-align: left; padding: 8px 12px; border: 1px solid #ddd; font-size: 12px; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 700; }
  .sev-c { color: #dc2626; font-weight: 700; }
  .sev-h { color: #ea580c; font-weight: 700; }
  .sev-m { color: #ca8a04; font-weight: 700; }
  .sev-l { color: #16a34a; font-weight: 700; }
  ol, ul { margin: 8px 0 8px 24px; }
  li { margin-bottom: 6px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 11px; color: #888; }
  @media print { body { padding: 24px; } .score-row { background: #f8f8f8 !important; -webkit-print-color-adjust: exact; } }
</style>
</head><body>
<h1>${prData.pr_title || 'Code Review Report'}</h1>
<div class="meta">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} &bull; Smart Code Inspection Platform</div>

<h2>1. Executive Overview</h2>
<p>${prData.executive_overview || 'No overview available.'}</p>

<div class="score-row">
  <div class="score-item"><span class="score-val">${prData.code_health_score ?? '—'}/100</span><span class="score-lbl">Code Health Score</span></div>
  <div class="score-item"><span class="score-val">${prData.risk_level || '—'}</span><span class="score-lbl">Risk Level</span></div>
  <div class="score-item"><span class="score-val">${prData.estimated_fix_time || '—'}</span><span class="score-lbl">Est. Fix Time</span></div>
</div>

<h2>2. Severity Breakdown</h2>
<table>
  <tr><th>Severity</th><th>Count</th><th>Impact</th></tr>
  <tr><td class="sev-c">Critical</td><td>${prData.severity_breakdown?.Critical ?? 0}</td><td>Immediate exploitation risk — fix before merge</td></tr>
  <tr><td class="sev-h">High</td><td>${prData.severity_breakdown?.High ?? 0}</td><td>Significant risk — fix within 24 hours</td></tr>
  <tr><td class="sev-m">Medium</td><td>${prData.severity_breakdown?.Medium ?? 0}</td><td>Code quality concern — fix within sprint</td></tr>
  <tr><td class="sev-l">Low</td><td>${prData.severity_breakdown?.Low ?? 0}</td><td>Minor improvement — fix when convenient</td></tr>
</table>

${criticalList ? `<h2>3. Critical Findings & Impact</h2><ul>${criticalList}</ul>` : ''}

<h2>4. Detailed Findings</h2>
<table>
  <tr><th>#</th><th>Issue Type</th><th>Severity</th><th>Line</th><th>Description</th></tr>
  ${findingsRows || '<tr><td colspan="5">No detailed findings available</td></tr>'}
</table>

${recommendationRows ? `
<h2>5. Remediation Recommendations</h2>
<table>
  <tr><th>Issue</th><th>Recommended Fix</th></tr>
  ${recommendationRows}
</table>` : ''}

${prData.positive_observations?.length > 0 ? `
<h2>6. Positive Observations</h2>
<ul>
${prData.positive_observations.map(o => `  <li>${o}</li>`).join('\n')}
</ul>` : ''}

<div class="footer">
  This report was automatically generated by the Smart Code Inspection Platform.
  All findings are based on static analysis and AI-powered vulnerability detection.
  &copy; ${new Date().getFullYear()} AI Code Review & Security Analysis Agent — Shaik Rafi
</div>
</body></html>`

  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 300)
  }
}

// ── RESULTS TAB ──────────────────────────────────────────────────
function ResultsTab({ result, onNewAnalysis }) {
  const [filter, setFilter] = useState('All')
  const [prReport, setPrReport] = useState(null)
  const [prLoading, setPrLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [fixedCode, setFixedCode] = useState(null)
  const [fixLoading, setFixLoading] = useState(false)
  const [showFixed, setShowFixed] = useState(false)
  const [copied, setCopied] = useState(false)

  // Auto-fetch PR summary when result loads
  useEffect(() => {
    if (!result || prReport) return
    const fetchPR = async () => {
      setPrLoading(true)
      try {
        const data = await api.prSummary(
          result,
          result.submission?.filename || 'uploaded_code',
          result.submission?.language || 'python'
        )
        setPrReport(data)
      } catch {
        setPrReport(null)
      } finally {
        setPrLoading(false)
      }
    }
    fetchPR()
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!result) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#c7c4d7' }}>
        <Icon.BarChart />
        <h3 style={{ margin: '1rem 0' }}>No analysis results yet</h3>
        <p>Go to the Scanner tab and run an analysis first.</p>
      </div>
    )
  }

  const { findings = [], summary = {}, execution_time_seconds, submission } = result
  const breakdown = summary.severity_breakdown ?? {}
  const riskLvl = summary.risk_level ?? 'Low'
  const filters = ['All', 'Critical', 'High', 'Medium', 'Low']
  const filtered = filter === 'All' ? findings : findings.filter(f => f.severity === filter)
  const healthScore = prReport?.code_health_score ?? Math.max(0, 100 - ((breakdown.Critical ?? 0) * 20 + (breakdown.High ?? 0) * 10 + (breakdown.Medium ?? 0) * 5 + (breakdown.Low ?? 0) * 2))

  const exportMarkdown = () => {
    let md = `# AI Code Analysis Report\n\n`
    md += `**File/Source:** ${submission?.filename ?? 'Pasted code'}\n`
    md += `**Language:** ${submission?.language ?? 'Auto-detected'}\n`
    md += `**Total Findings:** ${summary.total_findings ?? 0}\n`
    md += `**Risk Level:** ${riskLvl}\n\n`
    md += `## Findings\n\n`

    findings.forEach((f, i) => {
      md += `### ${i+1}. ${f.type}\n`
      md += `- **Severity:** ${f.severity}\n`
      md += `- **Category:** ${f.category ?? 'General'}\n`
      if (f.line > 0) md += `- **Line:** ${f.line}\n`
      if (f.owasp) md += `- **OWASP:** ${f.owasp}\n`
      md += `\n**Description:**\n${f.description}\n`
      if (f.recommendation) md += `\n**Recommendation:**\n${f.recommendation}\n`
      md += `\n---\n\n`
    })

    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-code-review-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '2rem' }}>
      {/* Left Column: Filters and Findings */}
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: filter === f ? '1px solid #8083ff' : '1px solid rgba(255,255,255,0.1)',
                background: filter === f ? 'rgba(128,131,255,0.1)' : 'transparent',
                color: filter === f ? '#c0c1ff' : '#908fa0',
                cursor: 'pointer'
              }}
            >
              {f} {f !== 'All' && `(${breakdown[f] ?? 0})`}
            </button>
          ))}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.length === 0 ? (
             <div style={{ color: '#c7c4d7', textAlign: 'center', padding: '2rem' }}>No findings for this filter.</div>
          ) : (
            filtered.map((f, i) => (
              <FindingCard
                key={`${f.type}-${i}`}
                finding={f}
                idx={i}
                code={result._submittedCode || ''}
                language={result._submittedLanguage || 'python'}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Column: Stats, Gauge, Fixes, PR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '8px' }}>
          <div>
            <h3 style={{ color: '#e4e1ed', marginBottom: '1rem' }}>Security Health</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', color: '#c7c4d7' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c0c1ff' }}>{summary.total_findings ?? 0}</div>
                <div style={{ fontSize: '0.875rem' }}>Total Findings</div>
              </div>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c0c1ff' }}>{execution_time_seconds?.toFixed(1) ?? '—'}s</div>
                <div style={{ fontSize: '0.875rem' }}>Scan Time</div>
              </div>
            </div>
          </div>
          <HealthGauge score={healthScore} />
        </div>

        <div className={`glass-panel risk-${riskLvl.toLowerCase()}`} style={{ padding: '1.5rem', borderRadius: '8px', borderLeft: `4px solid var(--sev-${sevCls(riskLvl)})` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 'bold', color: '#e4e1ed' }}>Overall Risk Level</span>
            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', background: `var(--sev-${sevCls(riskLvl)})`, color: '#fff', fontSize: '0.875rem', fontWeight: 'bold' }}>{riskLvl}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={exportMarkdown} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#e4e1ed', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
              <Icon.Download /> Export
            </button>
            {prReport && (
              <button onClick={() => setShowPreview(p => !p)} style={{ flex: 1, padding: '0.75rem', background: 'rgba(128,131,255,0.1)', border: '1px solid rgba(128,131,255,0.3)', color: '#c0c1ff', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <Icon.FileText /> {showPreview ? 'Close Report' : 'PR Report'}
              </button>
            )}
            {result._submittedCode && (
              <button
                onClick={async () => {
                  if (fixedCode) { setShowFixed(f => !f); return }
                  setFixLoading(true)
                  try {
                    const data = await api.fixAll(result._submittedCode, result._submittedLanguage || 'python', result.findings || [])
                    setFixedCode(data.fixed_code)
                    setShowFixed(true)
                  } catch (err) { setFixedCode('// Error generating fix: ' + err.message) ; setShowFixed(true) }
                  finally { setFixLoading(false) }
                }}
                disabled={fixLoading}
                style={{ flex: 1, padding: '0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                {fixLoading ? <><span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} /> Loading...</> : <><Icon.Wrench /> {showFixed ? 'Hide Fix' : 'Auto Fix All'}</>}
              </button>
            )}
          </div>
        </div>

        {/* Fixed Code Panel */}
        {showFixed && fixedCode && (
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', color: '#e4e1ed', fontWeight: 'bold' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icon.Wrench /> Complete Fixed Code</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(fixedCode)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2500)
                }}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#e4e1ed', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#908fa0', marginBottom: '0.5rem' }}>Original Code</div>
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', overflowX: 'auto', maxHeight: '200px', fontSize: '0.875rem', color: '#e4e1ed' }}>{result._submittedCode}</pre>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '0.5rem' }}>Fixed Code</div>
                <pre style={{ background: 'rgba(16,185,129,0.05)', padding: '1rem', borderRadius: '4px', overflowX: 'auto', maxHeight: '300px', fontSize: '0.875rem', color: '#e4e1ed' }}>{fixedCode}</pre>
              </div>
            </div>
          </div>
        )}

        {prLoading && (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: '#c7c4d7' }}>
            <span className="spin" style={{ width: 24, height: 24, borderWidth: 2, display: 'inline-block', marginBottom: '1rem' }} />
            <div>Generating PR Summary Report...</div>
          </div>
        )}

        {showPreview && prReport && (
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#e4e1ed' }}>📋 PR Report Preview</h3>
              <button onClick={() => downloadPDF(prReport)} style={{ background: '#8083ff', color: '#1000a9', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon.Download /> PDF
              </button>
            </div>
            <div style={{ color: '#c7c4d7', fontSize: '0.875rem' }}>
              <h2 style={{ color: '#c0c1ff', marginBottom: '0.5rem' }}>{prReport.pr_title || 'Code Review Report'}</h2>
              <p style={{ marginBottom: '1.5rem' }}>{prReport.executive_overview}</p>
              
              <h4 style={{ color: '#e4e1ed', marginBottom: '0.5rem' }}>Prioritized Fix List</h4>
              <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
                {(prReport.prioritized_fix_list || []).map((f, i) => (
                  <li key={i} style={{ marginBottom: '0.5rem' }}>{typeof f === 'string' ? f : `${f.type} (Line ${f.line})`}</li>
                ))}
              </ul>
              
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                 <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon.Cpu /> Fix time: {prReport.estimated_fix_time || 'N/A'}</span>
                 <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon.Activity /> Health: {prReport.code_health_score ?? healthScore}/100</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── FLOATING SECURITY ASSISTANT (uses /chat) ─────────────────────
const SUGGESTIONS = [
  'How to prevent SQL injection?',
  'Explain OWASP Top 10',
  'Secure error handling best practices',
]

function SecurityWidget({ result }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{
    role: 'bot',
    text: 'Hi there! I\'m Lyca, your AI assistant. I can answer any question — security, coding, general knowledge, math, or anything else. Try asking me something!',
    sources: [],
    relatedQuestions: ['How to prevent SQL injection?', 'Explain OWASP Top 10'],
    codeExample: '',
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const bottomRef = useRef()
  const inputRef = useRef()

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: q }])

    const newHistory = [...history, { role: 'user', content: q }]
    setLoading(true)

    try {
      const contextCode = result?._submittedCode || ''
      const contextFindings = result?.findings?.map(f => ({
        type: f.type, description: f.description, severity: f.severity, recommendation: f.recommendation
      })) || []

      const data = await api.chat(q, contextCode, contextFindings, newHistory.slice(-6))

      const botMsg = {
        role: 'bot',
        text: data.answer || 'I could not generate a response.',
        sources: data.sources || [],
        relatedQuestions: data.related_questions || [],
        codeExample: data.code_example || '',
      }

      setMessages(m => [...m, botMsg])
      setHistory([...newHistory, { role: 'assistant', content: data.answer || '' }])
    } catch (err) {
      setMessages(m => [...m, {
        role: 'bot',
        text: `Error: ${err.message}`,
        sources: [],
        relatedQuestions: [],
        codeExample: '',
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <div className="security-widget-container">
      {open && (
        <div className="security-widget-panel glass" style={{ background: '#1f1f27', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="security-widget-header" style={{ background: '#13131b', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#c0c1ff' }}>Lyca AI</div>
              <div style={{ fontSize: '0.7rem', color: '#908fa0' }}>Security Assistant</div>
            </div>
            <button className="security-widget-close" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#e4e1ed', cursor: 'pointer' }}>
              <Icon.X />
            </button>
          </div>

          <div className="security-widget-body" style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
            <div className="chat-messages" style={{ padding: '1rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`msg msg-${msg.role}`} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div className="msg-content" style={{ background: msg.role === 'user' ? '#8083ff' : '#34343d', color: msg.role === 'user' ? '#1000a9' : '#e4e1ed', padding: '0.75rem 1rem', borderRadius: '12px', borderBottomRightRadius: msg.role === 'user' ? 0 : '12px', borderBottomLeftRadius: msg.role === 'bot' ? 0 : '12px', fontSize: '0.875rem' }}>
                    <div className="msg-bubble">{msg.text}</div>
                    {msg.codeExample && (
                      <pre className="chat-code-block" style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', overflowX: 'auto', fontSize: '0.75rem' }}>{msg.codeExample}</pre>
                    )}
                    {msg.sources?.length > 0 && (
                      <div className="msg-sources" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {msg.sources.map((s, j) => (
                          <span key={j} className="msg-source" style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            <Icon.FileText /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.relatedQuestions?.length > 0 && (
                      <div className="chat-related" style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {msg.relatedQuestions.map((rq, j) => (
                          <button key={j} className="related-question-chip" onClick={() => send(rq)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'inherit', padding: '0.4rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left' }}>{rq}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="msg msg-bot" style={{ alignSelf: 'flex-start' }}>
                  <div className="msg-content" style={{ background: '#34343d', padding: '0.75rem 1rem', borderRadius: '12px', borderBottomLeftRadius: 0 }}>
                    <div className="typing" style={{ display: 'flex', gap: '4px' }}>
                      <span className="typing-dot" style={{ width: 6, height: 6, background: '#908fa0', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                      <span className="typing-dot" style={{ width: 6, height: 6, background: '#908fa0', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                      <span className="typing-dot" style={{ width: 6, height: 6, background: '#908fa0', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length < 3 && (
              <div className="security-widget-suggestions" style={{ padding: '0 1rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggest-chip" onClick={() => send(s)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#c7c4d7', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
            )}

            <div className="chat-input-bar" style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.5rem' }}>
              <textarea
                ref={inputRef}
                className="chat-input"
                style={{ flex: 1, minHeight: '38px', padding: '0.55rem 0.8rem', fontSize: '0.875rem', background: '#13131b', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1ed', borderRadius: '20px', resize: 'none', outline: 'none' }}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask Lyca anything..."
                rows={1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading} style={{ width: 38, height: 38, borderRadius: '50%', background: input.trim() && !loading ? '#8083ff' : '#34343d', color: input.trim() && !loading ? '#1000a9' : '#908fa0', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loading ? <span className="spin" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Icon.Send />}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className={`security-widget-fab ${open ? 'fab-open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Toggle Security Assistant"
        style={{ width: 56, height: 56, borderRadius: '50%', background: '#8083ff', color: '#1000a9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'transform 0.2s' }}
      >
        {open ? <Icon.X /> : <Icon.MessageSquare />}
      </button>
    </div>
  )
}


// ── ROOT APP ─────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('analyze')
  const [result, setResult] = useState(null)
  const [toast, setToast] = useState(null)
  const [online, setOnline] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    const check = () => api.ping().then(ok => setOnline(ok))
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [])

  const handleResult = useCallback((data, errMsg) => {
    if (errMsg) {
      setToast({ msg: `Analysis failed: ${errMsg}`, type: 'err' })
    } else {
      setResult(data)
      const crit = data?.summary?.severity_breakdown?.Critical ?? 0
      const total = data?.summary?.total_findings ?? 0
      setToast({
        msg: `Analysis complete — ${total} finding${total !== 1 ? 's' : ''}${crit > 0 ? ` (${crit} Critical)` : ''}`,
        type: crit > 0 ? 'err' : 'ok',
      })
    }
  }, [])

  const backendOk = online !== false

  return (
    <div className="app sentinel-app" style={{ minHeight: '100vh', background: '#13131b', color: '#e4e1ed', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Navbar */}
      <header className="sentinel-navbar" style={{ height: '80px', position: 'fixed', top: 0, left: 0, right: 0, background: 'rgba(19, 19, 27, 0.7)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', zIndex: 100 }}>
        <div className="sentinel-brand" style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c0c1ff' }}>
          <Icon.Shield /> SENTINEL_AI
        </div>
        <nav className="sentinel-nav" style={{ display: 'flex', gap: '1rem' }}>
          <button className={`sentinel-nav-btn ${tab==='analyze' ? 'active' : ''}`} onClick={()=>setTab('analyze')} style={{ background: tab==='analyze' ? 'rgba(128,131,255,0.1)' : 'transparent', color: tab==='analyze' ? '#c0c1ff' : '#908fa0', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: tab==='analyze' ? 'bold' : 'normal' }}>
            <Icon.Code /> Scanner
          </button>
          <button className={`sentinel-nav-btn ${tab==='results' ? 'active' : ''}`} onClick={()=>setTab('results')} disabled={!result} style={{ background: tab==='results' ? 'rgba(128,131,255,0.1)' : 'transparent', color: tab==='results' ? '#c0c1ff' : '#908fa0', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: result ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: tab==='results' ? 'bold' : 'normal', opacity: result ? 1 : 0.5 }}>
            <Icon.BarChart /> Results
          </button>
        </nav>
        <div className="sentinel-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <span className={`status-dot ${backendOk ? '' : 'offline'}`} style={{ width: 8, height: 8, borderRadius: '50%', background: backendOk ? '#10b981' : '#ef4444' }}/>
          <span className="status-label" style={{ color: backendOk ? '#10b981' : '#ef4444' }}>{backendOk ? 'Systems Online' : 'Offline'}</span>
        </div>
      </header>

      {/* Main Layout (Sidebar + Content) */}
      <div className="sentinel-layout" style={{ display: 'flex', paddingTop: '80px', minHeight: '100vh' }}>
        
        {/* Left Sidebar */}
        <aside className="sentinel-sidebar" style={{ width: '256px', position: 'fixed', top: '80px', bottom: 0, left: 0, background: 'rgba(19, 19, 27, 0.7)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div className="sidebar-section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#908fa0', marginBottom: '0.5rem' }}>Multi-Agent Engine</div>
          <p className="sidebar-status-text" style={{ fontSize: '0.875rem', color: analyzing ? '#c0c1ff' : '#e4e1ed', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {analyzing && <span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} />}
            {analyzing ? 'Active Scanning...' : 'Ready'}
          </p>
          
          {/* Agent steps shown when analyzing or after */}
          {(analyzing || progress) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {STEPS.map((step, i) => {
                const cur = STEP_ORDER.indexOf(progress)
                const status = cur === -1 ? 'waiting' : i < cur ? 'done' : i === cur ? 'running' : 'waiting'
                return (
                  <div key={step.key} className="sidebar-agent-step" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: status === 'waiting' ? 0.5 : 1 }}>
                    <div style={{ color: status === 'done' ? '#10b981' : status === 'running' ? '#c0c1ff' : '#908fa0' }}>
                      {status === 'running' ? <span className="spin" style={{ width: 14, height: 14, borderWidth: 2, display: 'block' }} /> : status === 'done' ? <Icon.CheckCircle /> : <step.Icon />}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: status === 'running' ? '#c0c1ff' : '#c7c4d7' }}>{step.text}</span>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Nav links */}
          <div className="sidebar-section-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#908fa0', marginBottom: '1rem' }}>Navigation</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            <a className={`sidebar-link ${tab==='analyze' ? 'active' : ''}`} onClick={()=>setTab('analyze')} style={{ color: tab==='analyze' ? '#c0c1ff' : '#c7c4d7', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem', borderRadius: '4px', background: tab==='analyze' ? 'rgba(255,255,255,0.05)' : 'transparent', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icon.Code /> Scanner</a>
            <a className={`sidebar-link ${tab==='results' ? 'active' : ''}`} onClick={()=>{if(result) setTab('results')}} style={{ color: tab==='results' ? '#c0c1ff' : '#c7c4d7', cursor: result ? 'pointer' : 'not-allowed', fontSize: '0.875rem', padding: '0.5rem', borderRadius: '4px', background: tab==='results' ? 'rgba(255,255,255,0.05)' : 'transparent', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: result ? 1 : 0.5 }}><Icon.BarChart /> Vulnerabilities</a>
          </nav>
          
          {/* Bottom: New Analysis button */}
          {result && (
            <button onClick={() => setTab('analyze')} style={{ marginTop: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1ed', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
              <Icon.Play /> New Analysis
            </button>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="sentinel-main" style={{ marginLeft: '256px', flex: 1, padding: '2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {tab === 'analyze' && (
              <AnalyzeTab onResult={handleResult} onTabSwitch={setTab} setAnalyzing={setAnalyzing} progress={progress} setProgress={setProgress} />
            )}
            {tab === 'results' && (
              <ResultsTab result={result} onNewAnalysis={() => setTab('analyze')} />
            )}
          </div>
        </main>

      </div>

      {/* Floating Security Widget */}
      <SecurityWidget result={result} />

      {/* Toast notification */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
