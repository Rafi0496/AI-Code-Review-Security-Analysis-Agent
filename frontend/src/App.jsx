import { useState, useEffect, useRef, useCallback } from 'react'
import './styles/index.css'
import { api } from './api/client'

const SEV_CLS = { Critical: 'risk-critical', High: 'risk-high', Medium: 'risk-medium', Low: 'risk-low' }
const sevCls = (s) => SEV_CLS[s] ?? 'risk-low'
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const detectLanguage = (code) => {
  if (!code) return 'python'
  if (/public\s+class\s+/.test(code) || /import\s+java\./.test(code) || /System\.out\.println/.test(code)) {
    return 'java'
  }
  return 'python'
}

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

export default function App() {
  const [code, setCode] = useState('')
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('paste') // paste or file
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const [result, setResult] = useState(null)
  const [filter, setFilter] = useState('All')
  const [prReport, setPrReport] = useState(null)

  const [fixState, setFixState] = useState({}) // track fixes per finding

  const runAnalysis = useCallback(async () => {
    if (mode === 'paste' && !code.trim()) return
    if (mode === 'file' && !file) return

    setLoading(true)
    setAnalyzing(true)
    setResult(null)

    try {
      await delay(500)
      let res
      if (mode === 'file') {
        res = await api.analyzeFile(file)
      } else {
        const detectedLang = detectLanguage(code)
        res = await api.analyzeText(code, detectedLang)
      }

      res._submittedCode = mode === 'file' ? '' : code
      res._submittedLanguage = res.submission?.language || detectLanguage(code)
      setResult(res)
    } catch (err) {
      console.error(err)
      alert("Analysis failed: " + err.message)
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }, [code, file, mode])

  useEffect(() => {
    if (!result || prReport) return
    const fetchPR = async () => {
      try {
        const data = await api.prSummary(
          result,
          result.submission?.filename || 'uploaded_code',
          result.submission?.language || 'python'
        )
        setPrReport(data)
      } catch (e) {
        console.error(e)
      }
    }
    fetchPR()
  }, [result])

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

  const findings = result?.findings || []
  const summary = result?.summary || {}
  const breakdown = summary.severity_breakdown || {}
  const healthScore = prReport?.code_health_score ?? Math.max(0, 100 - ((breakdown.Critical ?? 0) * 20 + (breakdown.High ?? 0) * 10 + (breakdown.Medium ?? 0) * 5 + (breakdown.Low ?? 0) * 2))
  const filtered = filter === 'All' ? findings : findings.filter(f => f.severity === filter)

  const loadFix = async (e, idx, finding) => {
    e.stopPropagation()
    if (fixState[idx]?.loading || fixState[idx]?.data) return
    
    setFixState(prev => ({ ...prev, [idx]: { loading: true } }))
    try {
      const data = await api.remediate(finding, code, result._submittedLanguage)
      setFixState(prev => ({ ...prev, [idx]: { loading: false, data } }))
    } catch (err) {
      setFixState(prev => ({ ...prev, [idx]: { loading: false, data: { fix_summary: 'Could not load fix: ' + err.message } } }))
    }
  }

  return (
    <>
      <header className="bg-surface/70 backdrop-blur-xl fixed top-0 w-full z-50 border-b border-white/10 shadow-[0_20px_40px_rgba(99,102,241,0.15)] hidden md:flex justify-between items-center px-margin-desktop max-w-container-max mx-auto h-20 left-0 right-0">
        <div className="flex items-center gap-gutter">
          <a className="font-headline-md text-headline-md font-black tracking-tighter text-primary" href="#">SENTINEL_AI</a>
          <nav className="flex items-center gap-stack-lg ml-stack-lg">
            <a className="text-on-surface-variant hover:text-on-surface transition-colors hover:bg-primary/10 transition-all duration-300 px-3 py-2 rounded-md active:scale-95 transition-transform" href="#">Dashboard</a>
            <a className="text-primary border-b-2 border-primary pb-1 active:scale-95 transition-transform" href="#">Code Analyzer</a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors hover:bg-primary/10 transition-all duration-300 px-3 py-2 rounded-md active:scale-95 transition-transform" href="#">History</a>
          </nav>
        </div>
        <div className="flex items-center gap-stack-md">
          <button className="text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined">notifications</span></button>
          <button className="text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined">settings</span></button>
          <button className="primary-gradient-button text-white px-4 py-2 rounded-lg font-label-caps text-label-caps uppercase hover:brightness-110 transition-all">Connect GitHub</button>
        </div>
      </header>

      <div className="flex flex-1 pt-20">
        <aside className="bg-surface-container-low/80 backdrop-blur-lg border-r border-white/5 h-[calc(100vh-80px)] w-64 fixed left-0 top-20 z-40 flex flex-col py-stack-lg px-stack-md hidden md:flex">
          <div className="mb-stack-lg px-4">
            <div className="flex items-center gap-3 mb-2">
              <div>
                <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-on-background">Multi-Agent Engine</h2>
                <p className={`text-xs ${analyzing ? 'text-primary animate-pulse' : 'text-emerald-500'}`}>{analyzing ? 'Active Scanning...' : 'System Ready'}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 flex flex-col gap-2">
            <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface rounded-lg transition-all duration-200 ease-in-out" href="#">
              <span className="material-symbols-outlined">dashboard</span>
              <span className="font-body-md text-body-md">Overview</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 bg-primary-container text-on-primary-container rounded-lg font-bold transition-all duration-200 ease-in-out" href="#">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>security</span>
              <span className="font-body-md text-body-md">Vulnerabilities</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface rounded-lg transition-all duration-200 ease-in-out" href="#">
              <span className="material-symbols-outlined">account_tree</span>
              <span className="font-body-md text-body-md">Dependency Tree</span>
            </a>
          </nav>
        </aside>

        <main className="flex-1 md:ml-64 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full">
          <div className="mb-section-gap">
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg mb-2">AI Code Analyzer</h1>
            <p className="text-on-surface-variant">Reviewing <span className="font-code-sm text-code-sm text-primary">{mode === 'file' ? file?.name || 'Uploaded File' : 'Paste Buffer'}</span></p>
          </div>

          {/* Scanner Input Area */}
          <div className="mb-section-gap glass-panel rounded-xl overflow-hidden border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="bg-surface-container-low px-4 py-3 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline-variant text-sm">code</span>
                <span className="font-code-sm text-code-sm text-on-surface-variant">Input Code</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('paste')} className={`px-3 py-1 rounded text-sm ${mode === 'paste' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'}`}>Paste</button>
                <button onClick={() => setMode('file')} className={`px-3 py-1 rounded text-sm ${mode === 'file' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'}`}>Upload</button>
                {mode === 'paste' && <button onClick={loadSample} className="px-3 py-1 rounded text-sm text-on-surface-variant hover:bg-surface-variant">Sample</button>}
              </div>
            </div>
            
            {mode === 'paste' ? (
              <div className="flex min-h-[300px] bg-[#1e1e24]">
                <div className="py-4 px-2 text-outline-variant text-right select-none min-w-[40px] border-r border-white/5 font-code-sm">
                  {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                </div>
                <textarea 
                  className="flex-1 bg-transparent border-none text-gray-300 p-4 font-code-sm resize-y outline-none"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="// Paste your source code here..."
                  spellCheck={false}
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      const s = e.target.selectionStart; const end = e.target.selectionEnd
                      setCode(c => c.slice(0, s) + '    ' + c.slice(end))
                      setTimeout(() => e.target.setSelectionRange(s + 4, s + 4), 0)
                    }
                  }}
                />
              </div>
            ) : (
              <div 
                className={`min-h-[300px] flex items-center justify-center flex-col m-4 rounded border-2 border-dashed ${dragOver ? 'border-primary bg-primary/5' : 'border-white/10'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }} />
                {file ? (
                  <>
                    <span className="material-symbols-outlined text-4xl mb-2 text-primary">description</span>
                    <div>{file.name}</div>
                    <button onClick={e => { e.stopPropagation(); setFile(null); setMode('paste') }} className="mt-4 px-4 py-2 bg-error/20 text-error rounded hover:bg-error/30 transition-colors">Remove File</button>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl mb-2 text-outline-variant">upload_file</span>
                    <div>Drop your source file here</div>
                    <div className="text-sm text-outline-variant">or click to browse</div>
                  </>
                )}
              </div>
            )}

            <div className="p-4 flex justify-end border-t border-white/5 bg-surface-container-low">
              <button 
                onClick={runAnalysis} 
                disabled={loading || !canRun} 
                className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-semibold text-sm uppercase tracking-wider flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <span className="spin"></span> : <span className="material-symbols-outlined text-lg" style={{fontVariationSettings: "'FILL' 1"}}>play_arrow</span>}
                {loading ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
          </div>

          {/* Results Area */}
          {result && (
            <>
              {/* Metrics Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter mb-section-gap">
                <div className="glass-panel rounded-xl p-stack-lg flex flex-col items-center justify-center md:col-span-4 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br from-${healthScore < 50 ? 'error' : healthScore < 80 ? 'risk-medium' : 'emerald-500'}/5 to-transparent z-0`}></div>
                  <div className="relative z-10 text-center">
                    <h3 className="font-label-caps text-label-caps text-outline uppercase tracking-widest mb-4">Code Health</h3>
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle className="text-surface-variant" cx="64" cy="64" fill="transparent" r="56" stroke="currentColor" strokeWidth="8"></circle>
                        <circle className={`text-${healthScore < 50 ? 'error' : healthScore < 80 ? 'risk-medium' : 'emerald-500'}`} cx="64" cy="64" fill="transparent" r="56" stroke="currentColor" strokeDasharray="351.85" strokeDashoffset={351.85 - (351.85 * healthScore) / 100} strokeLinecap="round" strokeWidth="8" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}></circle>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`font-display-metric text-display-metric text-${healthScore < 50 ? 'error' : healthScore < 80 ? 'risk-medium' : 'emerald-500'}`}>{healthScore}</span>
                        <span className="text-xs text-on-surface-variant">/100</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-stack-md">
                  {[
                    { label: 'Critical', count: breakdown.Critical || 0, color: 'risk-critical', icon: 'dangerous' },
                    { label: 'High', count: breakdown.High || 0, color: 'risk-high', icon: 'error' },
                    { label: 'Medium', count: breakdown.Medium || 0, color: 'risk-medium', icon: 'warning' },
                    { label: 'Low', count: breakdown.Low || 0, color: 'risk-low', icon: 'info' }
                  ].map(s => (
                    <div key={s.label} className={`glass-panel rounded-xl p-stack-md flex flex-col justify-between border-t-2 border-t-${s.color} glass-panel-interactive transition-all ${s.count === 0 ? 'opacity-70' : ''}`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`font-label-caps text-label-caps text-${s.color} uppercase`}>{s.label}</span>
                        <span className={`material-symbols-outlined text-${s.color}`} style={{fontVariationSettings: "'FILL' 1"}}>{s.icon}</span>
                      </div>
                      <span className="font-display-metric text-display-metric">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-section-gap mb-section-gap">
                {/* Findings List */}
                <div className="lg:col-span-5 flex flex-col gap-stack-md">
                  <div className="flex gap-2 mb-stack-md overflow-x-auto pb-2 border-b border-white/5">
                    {['All', 'Critical', 'High', 'Medium', 'Low'].map(f => {
                      const count = f === 'All' ? findings.length : breakdown[f] || 0
                      const active = filter === f
                      let cls = 'px-4 py-2 rounded-full font-label-caps text-label-caps whitespace-nowrap transition-colors '
                      if (active) cls += 'bg-surface-variant text-on-surface ring-1 ring-white/20'
                      else cls += `border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/50`
                      return <button key={f} onClick={() => setFilter(f)} className={cls}>{f} ({count})</button>
                    })}
                  </div>
                  
                  {filtered.length === 0 && <div className="text-outline-variant py-8 text-center">No findings to display.</div>}
                  
                  {filtered.map((f, idx) => (
                    <div key={idx} className={`glass-panel rounded-lg p-4 border-l-4 border-l-${sevCls(f.severity)} glass-panel-interactive group transition-all duration-300 mb-4`} data-line-target={`line-${f.line}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`bg-${sevCls(f.severity)}/20 text-${sevCls(f.severity)} px-2 py-1 rounded text-xs font-bold uppercase tracking-wider`}>{f.severity}</span>
                        <span className="font-code-sm text-code-sm text-outline-variant">Line {f.line}</span>
                      </div>
                      <h4 className="font-headline-md text-base font-semibold mb-2 group-hover:text-primary transition-colors">{f.type}</h4>
                      <p className="text-sm text-on-surface-variant mb-4">{f.description}</p>
                      
                      {/* Fix UI */}
                      <button onClick={(e) => loadFix(e, idx, f)} disabled={fixState[idx]?.loading} className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline">
                        {fixState[idx]?.loading ? 'Generating Fix...' : fixState[idx]?.data ? 'Fix generated' : 'View Fix'} <span className="material-symbols-outlined text-sm">{fixState[idx]?.data ? 'check' : 'arrow_forward'}</span>
                      </button>
                      
                      {fixState[idx]?.data && (
                         <div className="mt-4 p-3 bg-black/30 rounded border border-white/5 text-sm">
                           <div className="font-semibold mb-1 text-emerald-400">Recommendation</div>
                           <div className="text-gray-300 mb-3">{fixState[idx].data.fix_summary || f.recommendation}</div>
                           {(fixState[idx].data.before_code || fixState[idx].data.after_code) && (
                             <div className="grid grid-cols-1 gap-2 font-code-sm text-xs">
                               <div className="bg-error/10 p-2 rounded border-l-2 border-error text-gray-300 overflow-x-auto"><span className="text-error font-bold mb-1 block">- Before</span><pre>{fixState[idx].data.before_code}</pre></div>
                               <div className="bg-emerald-500/10 p-2 rounded border-l-2 border-emerald-500 text-gray-300 overflow-x-auto"><span className="text-emerald-500 font-bold mb-1 block">+ After</span><pre>{fixState[idx].data.after_code}</pre></div>
                             </div>
                           )}
                         </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Code View */}
                <div className="lg:col-span-7 flex flex-col h-full min-h-[600px]">
                  <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    <div className="bg-surface-container-low px-4 py-3 flex justify-between items-center border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-outline-variant text-sm">code</span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">Source Context</span>
                      </div>
                    </div>
                    <div className="bg-[#1e1e24] p-4 flex-1 overflow-auto font-code-sm text-code-sm leading-relaxed text-gray-300">
                      <pre>
                        <code>
                          {(result._submittedCode || '').split('\n').map((line, i) => {
                            const lineNum = i + 1
                            const hasFinding = filtered.some(f => f.line === lineNum)
                            const severityClass = hasFinding ? `code-line-highlight-critical bg-error/10` : ''
                            
                            return (
                              <div key={i} id={`line-${lineNum}`} className={`flex hover:bg-white/5 transition-colors ${severityClass}`}>
                                <span className="text-gray-500 w-10 inline-block select-none text-right pr-3 border-r border-white/5 mr-3">{lineNum}</span>
                                <span className={hasFinding ? 'text-error' : ''}>{line || ' '}</span>
                              </div>
                            )
                          })}
                        </code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="bg-surface-container-lowest w-full py-stack-lg border-t border-outline-variant/20 mt-auto md:ml-64 w-auto z-30">
        <div className="max-w-container-max mx-auto px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-4">
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Terms of Service</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">API Docs</a>
          </div>
        </div>
      </footer>
    </>
  )
}
