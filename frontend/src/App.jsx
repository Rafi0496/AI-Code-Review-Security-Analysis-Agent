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
      className="finding glass"
      style={{ animationDelay: `${Math.min(idx * 0.06, 0.8)}s` }}
    >
      <div className="finding-head" onClick={() => setOpen(o => !o)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}>
        <div className={`finding-sev-bar ${cls}`} />
        <div className="finding-info">
          <div className="finding-name">{finding.type}</div>
          <div className="finding-agent">
            {finding.agent ?? 'Analysis Agent'}&nbsp;&nbsp;·&nbsp;&nbsp;{finding.category ?? 'General'}
          </div>
        </div>
        <div className="finding-chips">
          <span className={`chip chip-${cls}`}>{finding.severity}</span>
          {finding.line > 0 && (
            <span className="chip chip-line">Line {finding.line}</span>
          )}
        </div>
        <span className={`chevron-icon ${open ? 'open' : ''}`}>
          <Icon.ChevronDown />
        </span>
      </div>

      {open && (
        <div className="finding-body">
          <p className="finding-desc">{finding.description}</p>
          {finding.owasp && (
            <div style={{ marginTop: '0.6rem' }}>
              <span className="chip chip-cat">{finding.owasp}</span>
            </div>
          )}
          {finding.recommendation && (
            <div className="finding-rec">
              <span className="finding-rec-label">Recommendation</span>
              {finding.recommendation}
            </div>
          )}

          {/* Remediation Agent Section */}
          {!fix && (
            <button className="view-fix-btn" onClick={loadFix} disabled={fixLoading}>
              {fixLoading ? (
                <><span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} /> Loading Fix...</>
              ) : (
                <><Icon.Wrench /> View Fix</>
              )}
            </button>
          )}

          {fix && (
            <div className="remediation-card">
              <div className="remediation-header">
                <Icon.Wrench /> Remediation Agent
                {fix.owasp_reference && <span className="chip chip-cat" style={{ marginLeft: 'auto' }}>{fix.owasp_reference}</span>}
              </div>
              <div className="remediation-summary">{fix.fix_summary}</div>

              {(fix.before_code || fix.after_code) && (
                <div className="diff-container">
                  <div className="diff-panel diff-before">
                    <div className="diff-label">Before (Vulnerable)</div>
                    <pre className="diff-code">{fix.before_code || '—'}</pre>
                  </div>
                  <div className="diff-panel diff-after">
                    <div className="diff-label">After (Fixed)</div>
                    <pre className="diff-code">{fix.after_code || '—'}</pre>
                  </div>
                </div>
              )}

              {fix.best_practice && (
                <div className="remediation-practice">
                  <span className="remediation-practice-label">Best Practice</span>
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

function AgentProgress({ progress }) {
  const cur = STEP_ORDER.indexOf(progress)
  return (
    <div className="agent-panel glass">
      <div className="agent-panel-title">
        <span className="spin" style={{ width: 14, height: 14, borderWidth: 2 }} />
        Multi-Agent Pipeline
      </div>
      {STEPS.map((step, i) => {
        const status = cur === -1 ? 'waiting' : i < cur ? 'done' : i === cur ? 'running' : 'waiting'
        return (
          <div key={step.key} className={`agent-step ${status}`}>
            <span className="step-icon-wrap">
              <step.Icon />
            </span>
            <span className="step-text">{step.text}</span>
            <span className={`step-badge step-${status}`}>
              {status === 'running' && <span className="spin" style={{ width: 10, height: 10, borderWidth: 2 }} />}
              {status === 'done' && <Icon.CheckCircle />}
              {status === 'running' ? 'Running' : status === 'done' ? 'Done' : 'Waiting'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── ANALYZE TAB ──────────────────────────────────────────────────
function AnalyzeTab({ onResult, onTabSwitch }) {
  const [code, setCode] = useState('')
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('paste')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const runAnalysis = useCallback(async () => {
    if (mode === 'paste' && !code.trim()) return
    if (mode === 'file' && !file) return

    setLoading(true)
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
      setProgress(null)
    }
  }, [code, file, mode, onResult, onTabSwitch])

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
    <div className="analyze-grid">
      {/* Left — editor */}
      <div className="editor-col">
        <div className="section-header">
          <h2 className="section-title gradient-text">Code Analysis</h2>
          <p className="section-sub">Paste source code or upload a file</p>
        </div>

        {/* Mode pills */}
        <div className="mode-row">
          <button
            className={`mode-pill ${mode === 'paste' ? 'mode-active' : ''}`}
            onClick={() => setMode('paste')}
          >
            <Icon.Code /> Paste Code
          </button>
          <button
            className={`mode-pill ${mode === 'file' ? 'mode-active' : ''}`}
            onClick={() => setMode('file')}
          >
            <Icon.Upload /> Upload File
          </button>
        </div>

        {mode === 'paste' ? (
          <>
            {/* Toolbar row */}
            <div className="toolbar-row" style={{ justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="toolbar-btn" onClick={loadSample} title="Load sample vulnerable code">
                  <Icon.Clipboard /> Load Sample
                </button>
                {code && (
                  <button className="toolbar-btn toolbar-btn-danger" onClick={() => setCode('')} title="Clear editor">
                    <Icon.Trash /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* Code editor */}
            <div className="editor-wrap">
              <div className="editor-bar">
                <div className="editor-dots">
                  <span className="dot dot-r" /><span className="dot dot-y" /><span className="dot dot-g" />
                </div>
                <span className="editor-lang-label">
                  <Icon.Code /> Source Code
                </span>
                <span className="editor-counter">
                  {code.split('\n').length} lines &nbsp;·&nbsp; {code.length} chars
                </span>
              </div>
              <textarea
                className="code-area"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={`// Paste your source code here`}
                spellCheck={false}
                autoComplete="off"
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
          </>
        ) : (
          /* File dropzone */
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }}
            />
            <div className="dropzone-icon-wrap">
              {file ? <Icon.File /> : <Icon.Upload />}
            </div>
            {file ? (
              <>
                <div className="dropzone-label">File Ready</div>
                <div className="dropzone-filename">
                  {file.name} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
                </div>
                <div className="dropzone-hint">Click or drop to replace</div>
                <button
                  className="toolbar-btn toolbar-btn-danger"
                  style={{ marginTop: '1rem', position: 'relative', zIndex: 10, display: 'inline-flex', margin: '1rem auto 0 auto' }}
                  onClick={(e) => { e.stopPropagation(); setFile(null); setMode('paste'); }}
                >
                  <Icon.X /> Remove File
                </button>
              </>
            ) : (
              <>
                <div className="dropzone-label">Drop your source file here</div>
                <div className="dropzone-hint">or click to browse any programming language</div>
              </>
            )}
          </div>
        )}

        {/* Run button */}
        <button
          className="run-btn"
          onClick={runAnalysis}
          disabled={loading || !canRun}
          aria-label="Run Security Analysis"
        >
          {loading ? (
            <span className="run-btn-loading">
              <span className="spin" style={{ width: 18, height: 18, borderWidth: 2.5 }} />
              Agents Running…
            </span>
          ) : (
            <span className="run-btn-idle">
              <Icon.Play />
              Run Security Analysis
            </span>
          )}
        </button>
      </div>

      {/* Right — progress or info cards */}
      <div className="info-col">
        {loading ? (
          <AgentProgress progress={progress} />
        ) : (
          <>
            <InfoCard icon={<Icon.Cpu />} title="Multi-Agent Pipeline" color="violet">
              Two specialized AI agents run in parallel —{' '}
              <strong style={{ color: 'var(--violet-l)' }}>Code Analysis Agent</strong> and{' '}
              <strong style={{ color: 'var(--cyan-l)' }}>Security Vulnerability Agent</strong> — then
              merged by the Orchestrator.
            </InfoCard>
            <InfoCard icon={<Icon.Shield />} title="OWASP Coverage" color="cyan">
              <div className="tag-wrap" style={{ marginTop: '0.5rem' }}>
                {['SQL Injection', 'XSS', 'CSRF', 'Command Injection',
                  'Path Traversal', 'Hardcoded Secrets', 'Broken Access'].map(t => (
                  <span key={t} className="chip chip-cat" style={{ fontSize: '0.65rem' }}>{t}</span>
                ))}
              </div>
            </InfoCard>
            <InfoCard icon={<Icon.Search />} title="Detection Layers" color="emerald">
              <ul className="detection-list">
                {[
                  ['AST + Radon', 'Static complexity analysis'],
                  ['TaintTracker', 'Source-to-sink flow analysis'],
                  ['Bandit', 'Python security linter'],
                  ['Gemini AI', 'Pattern & context detection'],
                ].map(([name, desc]) => (
                  <li key={name}>
                    <span className="det-name">{name}</span>
                    <span className="det-desc">{desc}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
          </>
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon, title, color, children }) {
  return (
    <div className={`info-card glass info-card-${color}`}>
      <div className={`info-card-icon icon-${color}`}>{icon}</div>
      <div className="info-card-title">{title}</div>
      <div className="info-card-body">{children}</div>
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
      <div className="empty-state">
        <div className="empty-state-icon"><Icon.BarChart /></div>
        <div className="empty-state-title">No analysis results yet</div>
        <div className="empty-state-sub">Go to the Analyze tab, paste your code, and click Run Security Analysis</div>
        <button className="run-btn" style={{ marginTop: '1.5rem', maxWidth: 260 }} onClick={onNewAnalysis}>
          <span className="run-btn-idle"><Icon.Play /> Start Analysis</span>
        </button>
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
    <div className="results-wrap">
      <div className="section-header">
        <h2 className="section-title gradient-text">Analysis Results</h2>
        <p className="section-sub">
          {submission?.filename ?? 'Pasted code'}&nbsp;·&nbsp;
          {submission?.language}&nbsp;·&nbsp;
          {submission?.lines ?? '—'} lines
        </p>
      </div>

      {/* Dashboard row: severity cards + health gauge */}
      <div className="dashboard-row">
        <div className="summary-grid">
          {[
            { key: 'Critical', cls: 'c' },
            { key: 'High',     cls: 'h' },
            { key: 'Medium',   cls: 'm' },
            { key: 'Low',      cls: 'l' },
          ].map(({ key, cls }) => (
            <button
              key={key}
              className={`sev-card glass ${filter === key ? 'sev-card-active' : ''}`}
              onClick={() => setFilter(f => f === key ? 'All' : key)}
              title={`Filter by ${key}`}
            >
              <div className={`sev-num ${cls}`}>{breakdown[key] ?? 0}</div>
              <div className="sev-label">{key}</div>
              <div className={`sev-indicator sev-ind-${cls}`} />
            </button>
          ))}
        </div>
        <HealthGauge score={healthScore} />
      </div>

      {/* Risk banner */}
      <div className={`risk-banner glass risk-${riskLvl.toLowerCase()}`}>
        <div className="risk-left">
          <div className="risk-label-row">
            <span className="risk-overline">Overall Risk Level</span>
          </div>
          <span className={`risk-pill risk-${riskLvl.toLowerCase()}`}>{riskLvl}</span>
        </div>
        <div className="risk-stats">
          <div className="risk-stat">
            <span className="risk-stat-val">{summary.total_findings ?? 0}</span>
            <span className="risk-stat-key">Total Findings</span>
          </div>
          <div className="risk-stat-divider" />
          <div className="risk-stat">
            <span className="risk-stat-val">{execution_time_seconds?.toFixed(2) ?? '—'}s</span>
            <span className="risk-stat-key">Scan Time</span>
          </div>
          <div className="risk-stat-divider" />
          <div className="risk-stat">
            <span className="risk-stat-val">{healthScore}</span>
            <span className="risk-stat-key">Health Score</span>
          </div>
        </div>
        <div className="risk-actions">
          <button className="export-btn" onClick={exportMarkdown}>
            <Icon.Download /> Export Markdown
          </button>
          {prReport && (
            <button className="export-btn" onClick={() => setShowPreview(p => !p)} style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.08)', color: 'var(--violet-l)' }}>
              <Icon.FileText /> {showPreview ? 'Close Preview' : 'Preview Report'}
            </button>
          )}
          {result._submittedCode && (
            <button
              className="export-btn"
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
              style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: 'var(--emerald-l)' }}
            >
              {fixLoading ? <><span className="spin" style={{ width: 12, height: 12, borderWidth: 2 }} /> Generating...</> : <><Icon.Wrench /> {showFixed ? 'Hide Fixed Code' : 'Generate Fixed Code'}</>}
            </button>
          )}
        </div>
      </div>

      {/* Fixed Code Panel */}
      {showFixed && fixedCode && (
        <div className="remediation-card" style={{ marginBottom: '1.5rem' }}>
          <div className="remediation-header">
            <Icon.Wrench /> Complete Fixed Code
            <button
              className="export-btn"
              style={{ marginLeft: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
              onClick={() => { navigator.clipboard.writeText(fixedCode); }}
            >
              <Icon.Copy /> Copy Code
            </button>
          </div>
          <div className="diff-container" style={{ flexDirection: 'column' }}>
            <div className="diff-panel diff-before" style={{ borderRight: 'none', borderBottom: '1px solid var(--glass-border)', maxHeight: '300px', overflow: 'auto' }}>
              <div className="diff-label">Original Code (With Issues)</div>
              <pre className="diff-code">{result._submittedCode || '—'}</pre>
            </div>
            <div className="diff-panel diff-after" style={{ maxHeight: '300px', overflow: 'auto' }}>
              <div className="diff-label">Fixed Code (All Issues Resolved)</div>
              <pre className="diff-code">{fixedCode}</pre>
            </div>
          </div>
        </div>
      )}

      {prLoading && (
        <div className="pr-report-card glass" style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="spin" style={{ width: 20, height: 20, borderWidth: 2.5 }} />
          <div style={{ marginTop: '0.75rem', color: 'var(--text-3)', fontSize: '0.85rem' }}>Generating PR Summary Report...</div>
        </div>
      )}

      {showPreview && prReport && (
        <div className="pr-preview-modal glass">
          <div className="pr-preview-header">
            <h3>📋 Report Preview</h3>
            <button className="run-btn" onClick={() => downloadPDF(prReport)} style={{ minWidth: 'auto', padding: '0.5rem 1.2rem' }}>
              <span className="run-btn-idle"><Icon.Download /> Download Final PDF</span>
            </button>
          </div>
          <div className="pr-preview-content">
            <h1>{prReport.pr_title || 'Code Review Report'}</h1>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1.5rem' }}>Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <h2>Executive Overview</h2>
            <p>{prReport.executive_overview}</p>
            <div className="pr-preview-stats">
              <div><strong>{prReport.code_health_score ?? healthScore}/100</strong> Code Health</div>
              <div><strong>{prReport.risk_level || 'Unknown'}</strong> Risk Level</div>
              <div><strong>{prReport.estimated_fix_time || 'TBD'}</strong> Fix Time</div>
            </div>
            <h2>Severity Breakdown</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0.5rem 0 1rem' }}>
              <thead><tr style={{ background: '#f5f5f5' }}><th style={{ padding: '8px 12px', border: '1px solid #ddd', textAlign: 'left', fontSize: '0.75rem' }}>Severity</th><th style={{ padding: '8px 12px', border: '1px solid #ddd', textAlign: 'center', fontSize: '0.75rem' }}>Count</th></tr></thead>
              <tbody>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #eee', color: '#dc2626', fontWeight: 700 }}>Critical</td><td style={{ padding: '6px 12px', border: '1px solid #eee', textAlign: 'center' }}>{prReport.severity_breakdown?.Critical ?? 0}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #eee', color: '#ea580c', fontWeight: 700 }}>High</td><td style={{ padding: '6px 12px', border: '1px solid #eee', textAlign: 'center' }}>{prReport.severity_breakdown?.High ?? 0}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #eee', color: '#ca8a04', fontWeight: 700 }}>Medium</td><td style={{ padding: '6px 12px', border: '1px solid #eee', textAlign: 'center' }}>{prReport.severity_breakdown?.Medium ?? 0}</td></tr>
                <tr><td style={{ padding: '6px 12px', border: '1px solid #eee', color: '#16a34a', fontWeight: 700 }}>Low</td><td style={{ padding: '6px 12px', border: '1px solid #eee', textAlign: 'center' }}>{prReport.severity_breakdown?.Low ?? 0}</td></tr>
              </tbody>
            </table>
            <h2>Detailed Findings & Recommendations</h2>
            {(prReport.detailed_findings || prReport.prioritized_fix_list || []).map((f, idx) => (
              <div key={idx} style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111' }}>{idx + 1}. {typeof f === 'string' ? f : f.type}</div>
                {typeof f !== 'string' && <>
                  <div style={{ fontSize: '0.75rem', color: '#666', margin: '0.3rem 0' }}>Severity: <strong style={{ color: f.severity === 'Critical' ? '#dc2626' : f.severity === 'High' ? '#ea580c' : '#ca8a04' }}>{f.severity}</strong> · Line {f.line}</div>
                  <div style={{ fontSize: '0.8rem', color: '#444', margin: '0.3rem 0' }}>{f.description}</div>
                  {f.recommendation && <div style={{ fontSize: '0.8rem', color: '#166534', background: '#f0fdf4', padding: '0.5rem', borderRadius: '4px', marginTop: '0.3rem' }}>💡 {f.recommendation}</div>}
                </>}
              </div>
            ))}
          </div>
        </div>
      )}

      {prReport && !showPreview && (
        <div className="pr-report-card glass">
          <div className="pr-report-header">
            <Icon.GitMerge />
            <div>
              <div className="pr-report-title">{prReport.pr_title || 'Code Review Report'}</div>
              <div className="pr-report-meta">Auto-generated by PR Summary Agent</div>
            </div>
          </div>

          <div className="pr-report-overview">{prReport.executive_overview}</div>

          {prReport.prioritized_fix_list?.length > 0 && (
            <div className="pr-fix-section">
              <div className="pr-fix-heading">Prioritized Fix List</div>
              <ol className="pr-fix-list">
                {prReport.prioritized_fix_list.map((fix, i) => (
                  <li key={i} className="pr-fix-item">{typeof fix === 'string' ? fix : `${fix.type} (Line ${fix.line})`}</li>
                ))}
              </ol>
            </div>
          )}

          {prReport.positive_observations?.length > 0 && (
            <div className="pr-positives">
              <div className="pr-fix-heading" style={{ color: 'var(--emerald)' }}>Positive Observations</div>
              <ul>
                {prReport.positive_observations.map((obs, i) => (
                  <li key={i} style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.3rem' }}>{obs}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pr-report-footer">
            <span className="chip chip-time" style={{ gap: '0.3rem' }}>
              <Icon.Cpu /> Fix time: {prReport.estimated_fix_time || 'N/A'}
            </span>
            <span className="chip chip-cat" style={{ gap: '0.3rem' }}>
              <Icon.Activity /> Health: {prReport.code_health_score ?? healthScore}/100
            </span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-row">
        <div className="filter-bar">
          {filters.map(f => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? `fc-active fc-active-${f.toLowerCase()}` : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}{f !== 'All' && ` (${breakdown[f] ?? 0})`}
            </button>
          ))}
        </div>
        <span className="filter-count">
          {filtered.length} of {findings.length} findings
        </span>
      </div>

      {/* Findings */}
      <div className="findings-list">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-state-icon"><Icon.CheckCircle /></div>
            <div className="empty-state-title">
              {filter === 'All' ? 'No findings detected' : `No ${filter} severity findings`}
            </div>
            <div className="empty-state-sub">
              {filter === 'All' ? 'Clean code — no security issues detected' : 'Try a different severity filter'}
            </div>
          </div>
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
        <div className="security-widget-panel glass">
          <div className="security-widget-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>Lyca, Your Chatbot</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Powered by Groq AI</div>
            </div>
            <button className="security-widget-close" onClick={() => setOpen(false)}>
              <Icon.X />
            </button>
          </div>

          <div className="security-widget-body">
            <div className="chat-messages" style={{ padding: '1rem', flex: 1, minHeight: 0 }}>
              {messages.map((msg, i) => (
                <div key={i} className={`msg msg-${msg.role}`}>
                  <div className="msg-content" style={{ width: '100%' }}>
                    <div className="msg-bubble">{msg.text}</div>
                    {msg.codeExample && (
                      <pre className="chat-code-block">{msg.codeExample}</pre>
                    )}
                    {msg.sources?.length > 0 && (
                      <div className="msg-sources">
                        {msg.sources.map((s, j) => (
                          <span key={j} className="msg-source">
                            <Icon.FileText /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.relatedQuestions?.length > 0 && (
                      <div className="chat-related">
                        {msg.relatedQuestions.map((rq, j) => (
                          <button key={j} className="related-question-chip" onClick={() => send(rq)}>{rq}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="msg msg-bot">
                  <div className="msg-content">
                    <div className="msg-bubble">
                      <div className="typing">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length < 3 && (
              <div className="security-widget-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggest-chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}

            <div className="chat-input-bar">
              <textarea
                ref={inputRef}
                className="chat-input"
                style={{ minHeight: '38px', padding: '0.55rem 0.8rem', fontSize: '0.8rem' }}
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
              <button className="send-btn" onClick={() => send()} disabled={!input.trim() || loading} style={{ width: 38, height: 38 }}>
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
      >
        <span className="fab-icon-default"><Icon.Shield /></span>
        <span className="fab-icon-close"><Icon.X /></span>
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

  const resultCount = result?.summary?.total_findings

  return (
    <div className="app">
      {/* Animated orb background */}
      <div className="bg-canvas" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Navbar */}
      <nav className="navbar" role="navigation" aria-label="Main navigation">
        <div className="navbar-brand">
          <div className="brand-shield">
            <Icon.Shield />
          </div>
          <div>
            <div className="brand-name">
              <span>Smart Code Inspection</span> Platform
            </div>
            <div className="brand-tag">Security &amp; Quality Review Platform</div>
          </div>
        </div>

        <div className="nav-tabs" role="tablist">
          {[
            { key: 'analyze', Icon: Icon.Code,         label: 'Analyze' },
            { key: 'results', Icon: Icon.BarChart,      label: resultCount != null ? `Results (${resultCount})` : 'Results' },
          ].map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`nav-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <t.Icon />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-status">
          <span className={`status-dot ${online === false ? 'offline' : ''}`} />
          {online === false ? <Icon.WifiOff /> : <Icon.Wifi />}
        </div>
      </nav>

      {/* Content */}
      <main className="main" role="main">
        {tab === 'analyze' && (
          <AnalyzeTab onResult={handleResult} onTabSwitch={setTab} />
        )}
        {tab === 'results' && (
          <ResultsTab result={result} onNewAnalysis={() => setTab('analyze')} />
        )}
      </main>

      {/* Floating Security Widget */}
      <SecurityWidget result={result} />

      {/* Toast notification */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
