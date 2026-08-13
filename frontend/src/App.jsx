import { useState, useEffect, useRef, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts'
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

function downloadPDF(prData) {
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
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #000; padding: 48px; line-height: 1.7; font-size: 13px; background: #fff; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 12px; }
  h2 { font-size: 16px; font-weight: 700; margin: 28px 0 10px; border-bottom: 1px solid #000; padding-bottom: 6px; }
  p { margin-bottom: 10px; }
  .meta { font-size: 12px; color: #000; margin-bottom: 24px; }
  .score-row { display: flex; gap: 32px; margin: 16px 0 24px; padding: 16px; border: 1px solid #000; }
  .score-item { display: flex; flex-direction: column; }
  .score-val { font-size: 28px; font-weight: 700; color: #000; }
  .score-lbl { font-size: 11px; color: #000; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { text-align: left; padding: 8px 12px; border: 1px solid #000; font-size: 12px; vertical-align: top; }
  th { background: #fff; font-weight: 700; border-bottom: 2px solid #000; }
  ol, ul { margin: 8px 0 8px 24px; }
  li { margin-bottom: 6px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #000; font-size: 11px; color: #000; }
  @media print { body { padding: 24px; } }
</style>
</head><body>
<h1>${prData.pr_title || 'Code Review Report'}</h1>
<div class="meta">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} &bull; AI Code Analyzer</div>

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
  <tr><td><strong>Critical</strong></td><td>${prData.severity_breakdown?.Critical ?? 0}</td><td>Immediate exploitation risk — fix before merge</td></tr>
  <tr><td><strong>High</strong></td><td>${prData.severity_breakdown?.High ?? 0}</td><td>Significant risk — fix within 24 hours</td></tr>
  <tr><td><strong>Medium</strong></td><td>${prData.severity_breakdown?.Medium ?? 0}</td><td>Code quality concern — fix within sprint</td></tr>
  <tr><td><strong>Low</strong></td><td>${prData.severity_breakdown?.Low ?? 0}</td><td>Minor improvement — fix when convenient</td></tr>
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
  This report was automatically generated by the AI Code Analyzer.
  All findings are based on static analysis and AI-powered vulnerability detection.
</div>
</body></html>`

  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 300)
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('scanner')
  const [code, setCode] = useState('')
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('paste')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const [result, setResult] = useState(null)
  const [filter, setFilter] = useState('All')
  const [prReport, setPrReport] = useState(null)
  const [prLoading, setPrLoading] = useState(false)

  const [fixState, setFixState] = useState({})
  const [fixedCode, setFixedCode] = useState(null)
  const [isFixingAll, setIsFixingAll] = useState(false)
  const [showFixedCode, setShowFixedCode] = useState(false)

  const handlePaste = async () => {
    setMode('paste')
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText()
        if (text) setCode(text)
      } else {
        alert("Clipboard API not available. Please paste manually.")
      }
    } catch (err) {
      console.error('Failed to read clipboard', err)
      alert("Please manually paste your code. (Clipboard access denied or unsupported).")
    }
  }

  const runAnalysis = useCallback(async () => {
    if (mode === 'paste' && !code.trim()) return
    if (mode === 'file' && !file) return

    setLoading(true)
    setAnalyzing(true)
    setResult(null)
    setPrReport(null)
    setFixedCode(null)
    setShowFixedCode(false)

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
      setActiveTab('results')
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
      setPrLoading(true)
      try {
        const data = await api.prSummary(
          result,
          result.submission?.filename || 'uploaded_code',
          result.submission?.language || 'python'
        )
        setPrReport(data)
      } catch (e) {
        console.error(e)
      } finally {
        setPrLoading(false)
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

  const handleFixAll = async () => {
    if (!result || !result.findings) return
    setIsFixingAll(true)
    setShowFixedCode(true)
    try {
      const res = await api.fixAll(result._submittedCode, result._submittedLanguage, result.findings)
      if (res.status === 'success') {
        setFixedCode(res.fixed_code)
      } else {
        alert("Failed to fix code: " + res.message)
        setShowFixedCode(false)
      }
    } catch (err) {
      alert("Failed to fix code: " + err.message)
      setShowFixedCode(false)
    } finally {
      setIsFixingAll(false)
    }
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
      const data = await api.remediate(finding, result._submittedCode, result._submittedLanguage)
      setFixState(prev => ({ ...prev, [idx]: { loading: false, data } }))
    } catch (err) {
      setFixState(prev => ({ ...prev, [idx]: { loading: false, data: { fix_summary: 'Could not load fix: ' + err.message } } }))
    }
  }

  // Chart Data
  const chartData = [
    { name: 'Critical', value: breakdown.Critical || 0, fill: '#ef4444' },
    { name: 'High', value: breakdown.High || 0, fill: '#f97316' },
    { name: 'Medium', value: breakdown.Medium || 0, fill: '#eab308' },
    { name: 'Low', value: breakdown.Low || 0, fill: '#3b82f6' }
  ].filter(d => d.value > 0)

  return (
    <>
      <header className="bg-surface/70 backdrop-blur-xl fixed top-0 w-full z-50 border-b border-white/10 shadow-[0_20px_40px_rgba(99,102,241,0.15)] hidden md:flex justify-between items-center px-margin-desktop max-w-container-max mx-auto h-20 left-0 right-0">
        <div className="flex items-center gap-gutter">
          <a className="font-headline-md text-headline-md font-black tracking-tighter text-primary" href="#">AI Code Analyzer</a>
          <nav className="flex items-center gap-stack-lg ml-stack-lg">
            <button onClick={() => setActiveTab('scanner')} className={`${activeTab === 'scanner' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-on-surface hover:bg-primary/10'} px-3 py-2 rounded-md active:scale-95 transition-all duration-300 font-semibold`}>Scanner</button>
            <button onClick={() => setActiveTab('results')} disabled={!result} className={`${activeTab === 'results' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant'} ${!result ? 'opacity-50 cursor-not-allowed' : 'hover:text-on-surface hover:bg-primary/10'} px-3 py-2 rounded-md active:scale-95 transition-all duration-300 font-semibold`}>Results</button>
            <button onClick={() => setActiveTab('agents')} className={`${activeTab === 'agents' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-on-surface hover:bg-primary/10'} px-3 py-2 rounded-md active:scale-95 transition-all duration-300 font-semibold`}>Agents Pipeline</button>
          </nav>
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
            <button onClick={() => setActiveTab('scanner')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ${activeTab === 'scanner' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
              <span className="material-symbols-outlined">search</span>
              <span className="font-body-md text-body-md">Scanner Engine</span>
            </button>
            <button onClick={() => { if(result) setActiveTab('results') }} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ${activeTab === 'results' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-variant'} ${!result ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>security</span>
              <span className="font-body-md text-body-md">Vulnerabilities</span>
            </button>
            <button onClick={() => setActiveTab('agents')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ${activeTab === 'agents' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-variant'}`}>
              <span className="material-symbols-outlined">hub</span>
              <span className="font-body-md text-body-md">Agents Pipeline</span>
            </button>
          </nav>
        </aside>

        <main className="flex-1 md:ml-64 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full">
          {activeTab === 'agents' && (
            <div>
              <div className="mb-section-gap">
                <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg mb-2">Agents Pipeline</h1>
                <p className="text-on-surface-variant">Visualize the multi-agent system executing parallel tasks and analyzing code structure.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                  {/* Code Analysis Agent */}
                  <div className="glass-panel rounded-xl p-6 border-t-2 border-primary relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-primary">Code Analysis Agent</h3>
                      <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>psychology</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4">Parses AST, performs semantic analysis, and flags structural code smells.</p>
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${analyzing ? 'bg-primary animate-pulse' : 'bg-emerald-500'}`}></span>
                       <span className="text-xs text-outline-variant">{analyzing ? 'Analyzing AST...' : 'Idle'}</span>
                    </div>
                  </div>

                  {/* Security Vulnerability Agent */}
                  <div className="glass-panel rounded-xl p-6 border-t-2 border-risk-critical relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-risk-critical">Security Agent</h3>
                      <span className="material-symbols-outlined text-risk-critical" style={{fontVariationSettings: "'FILL' 1"}}>security</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4">Cross-references OWASP Top 10 to detect injection vulnerabilities and hardcoded secrets.</p>
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${analyzing ? 'bg-risk-critical animate-pulse' : 'bg-emerald-500'}`}></span>
                       <span className="text-xs text-outline-variant">{analyzing ? 'Scanning signatures...' : 'Idle'}</span>
                    </div>
                  </div>

                  {/* Remediation Agent */}
                  <div className="glass-panel rounded-xl p-6 border-t-2 border-emerald-500 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-emerald-500">Remediation Agent</h3>
                      <span className="material-symbols-outlined text-emerald-500" style={{fontVariationSettings: "'FILL' 1"}}>healing</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4">Generates context-aware, completely secure code replacements for detected vulnerabilities.</p>
                    <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${isFixingAll ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                       <span className="text-xs text-outline-variant">{isFixingAll ? 'Generating fixes...' : 'Idle'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scanner' && (
            <div>
              <div className="mb-section-gap">
                <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg mb-2">AI Code Analyzer</h1>
                <p className="text-on-surface-variant">Submit your code for multi-agent security analysis and remediation.</p>
              </div>

              {/* Scanner Input Area */}
              <div className="mb-section-gap glass-panel rounded-xl overflow-hidden border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <div className="bg-surface-container-low px-4 py-3 flex justify-between items-center border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline-variant text-sm">code</span>
                    <span className="font-code-sm text-code-sm text-on-surface-variant">Input Code</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handlePaste} className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${mode === 'paste' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'}`}><span className="material-symbols-outlined" style={{fontSize: '16px'}}>content_paste</span> Paste</button>
                    <button onClick={() => setMode('file')} className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${mode === 'file' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'}`}><span className="material-symbols-outlined" style={{fontSize: '16px'}}>upload</span> Upload</button>
                    {mode === 'paste' && <button onClick={loadSample} className="px-3 py-1 rounded text-sm text-on-surface-variant hover:bg-surface-variant">Sample</button>}
                  </div>
                </div>
                
                {mode === 'paste' ? (
                  <div className="flex min-h-[400px] bg-[#1e1e24]">
                    <div className="py-4 px-2 text-outline-variant text-right select-none min-w-[40px] border-r border-white/5 font-code-sm">
                      {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                    </div>
                    <textarea 
                      className="flex-1 bg-transparent border-none text-gray-300 p-4 font-code-sm resize-y outline-none"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="// Click 'Paste' to import from clipboard, or type your source code here..."
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
                    className={`min-h-[400px] flex items-center justify-center flex-col m-4 rounded border-2 border-dashed cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/30'}`}
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
            </div>
          )}
          
          {activeTab === 'results' && result && (
            <div>
              <div className="mb-section-gap flex justify-between items-end">
                <div>
                  <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg mb-2">Analysis Results</h1>
                  <p className="text-on-surface-variant">Reviewing <span className="font-code-sm text-code-sm text-primary">{mode === 'file' ? file?.name || 'Uploaded File' : 'Paste Buffer'}</span></p>
                </div>
                {prReport && (
                  <button 
                    onClick={() => downloadPDF(prReport)}
                    className="bg-surface-variant text-on-surface px-4 py-2 rounded-lg font-semibold text-sm uppercase tracking-wider flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all duration-200 border border-white/10"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Download PR Summary (PDF)
                  </button>
                )}
                {!prReport && prLoading && (
                  <span className="text-outline-variant text-sm flex items-center gap-2"><span className="spin" style={{width: 14, height: 14}}></span> Generating PR Summary...</span>
                )}
              </div>

              {/* Analytics Dashboard with Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-section-gap">
                {/* Health Score */}
                <div className="glass-panel rounded-xl p-stack-lg flex flex-col items-center justify-center lg:col-span-4 relative overflow-hidden">
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
                
                {/* Visual Chart */}
                <div className="glass-panel rounded-xl p-stack-md flex flex-col items-center justify-center lg:col-span-4 relative">
                  <h3 className="font-label-caps text-label-caps text-outline uppercase tracking-widest mb-2 w-full text-center">Severity Distribution</h3>
                  {chartData.length > 0 ? (
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: 'rgba(19, 19, 27, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-outline-variant text-sm">No Vulnerabilities Detected</div>
                  )}
                </div>

                {/* Vulnerability Counts */}
                <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                  {[
                    { label: 'Critical', count: breakdown.Critical || 0, color: 'risk-critical', icon: 'dangerous' },
                    { label: 'High', count: breakdown.High || 0, color: 'risk-high', icon: 'error' },
                    { label: 'Medium', count: breakdown.Medium || 0, color: 'risk-medium', icon: 'warning' },
                    { label: 'Low', count: breakdown.Low || 0, color: 'risk-low', icon: 'info' }
                  ].map(s => (
                    <div key={s.label} className={`glass-panel rounded-xl p-4 flex flex-col justify-between border-t-2 border-t-${s.color} glass-panel-interactive transition-all ${s.count === 0 ? 'opacity-70' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`font-label-caps text-label-caps text-${s.color} uppercase`}>{s.label}</span>
                        <span className={`material-symbols-outlined text-${s.color}`} style={{fontVariationSettings: "'FILL' 1", fontSize: '18px'}}>{s.icon}</span>
                      </div>
                      <span className="text-3xl font-bold">{s.count}</span>
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
                         <div className="mt-4 p-4 bg-surface-dim rounded-lg border border-primary/20 text-sm shadow-inner relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-primary"></div>
                           
                           {/* Remediation Agent Header */}
                           <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
                             <div className="bg-primary/20 p-1.5 rounded-md">
                               <span className="material-symbols-outlined text-primary" style={{fontSize: '16px', fontVariationSettings: "'FILL' 1"}}>healing</span>
                             </div>
                             <div className="font-semibold text-primary uppercase tracking-wide text-xs">Remediation Agent</div>
                           </div>
                           
                           <div className="font-semibold mb-1 text-emerald-400">Recommendation</div>
                           <div className="text-gray-300 mb-4">{fixState[idx].data.fix_summary || f.recommendation}</div>
                           
                           {(fixState[idx].data.before_code || fixState[idx].data.after_code) && (
                             <div className="grid grid-cols-1 gap-2 font-code-sm text-xs">
                               <div className="bg-error/10 p-3 rounded border border-error/30 text-gray-300 overflow-x-auto"><span className="text-error font-bold mb-1 block">- Original</span><pre>{fixState[idx].data.before_code}</pre></div>
                               <div className="bg-emerald-500/10 p-3 rounded border border-emerald-500/30 text-gray-300 overflow-x-auto"><span className="text-emerald-500 font-bold mb-1 block">+ Secured</span><pre>{fixState[idx].data.after_code}</pre></div>
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
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-outline-variant text-sm">code</span>
                          <span className="font-code-sm text-code-sm text-on-surface-variant">Source Context</span>
                        </div>
                        
                        {/* Toggle Original vs Fixed */}
                        {fixedCode && (
                          <div className="flex bg-surface-dim rounded-md p-0.5 border border-white/5">
                            <button onClick={() => setShowFixedCode(false)} className={`px-3 py-1 text-xs rounded-sm transition-colors ${!showFixedCode ? 'bg-surface-variant text-white' : 'text-outline-variant hover:text-white'}`}>Original</button>
                            <button onClick={() => setShowFixedCode(true)} className={`px-3 py-1 text-xs rounded-sm transition-colors flex items-center gap-1 ${showFixedCode ? 'bg-emerald-500/20 text-emerald-400' : 'text-outline-variant hover:text-emerald-400'}`}><span className="material-symbols-outlined" style={{fontSize: '14px'}}>check_circle</span> Secured</button>
                          </div>
                        )}
                      </div>
                      
                      <button 
                        onClick={handleFixAll} 
                        disabled={isFixingAll || (findings.length === 0 && !fixedCode)} 
                        className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-semibold transition-all ${isFixingAll ? 'bg-surface-variant text-outline-variant cursor-not-allowed' : fixedCode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-primary text-on-primary hover:brightness-110 active:scale-95'}`}
                      >
                        {isFixingAll ? (
                          <><span className="spin" style={{width: 14, height: 14}}></span> Generating...</>
                        ) : fixedCode ? (
                          <><span className="material-symbols-outlined" style={{fontSize: '18px'}}>refresh</span> Regenerate Fix</>
                        ) : (
                          <><span className="material-symbols-outlined" style={{fontSize: '18px', fontVariationSettings: "'FILL' 1"}}>auto_fix</span> Generate Fixed Code</>
                        )}
                      </button>
                    </div>
                    
                    <div className="bg-[#1e1e24] p-4 flex-1 overflow-auto font-code-sm text-code-sm leading-relaxed text-gray-300">
                      {showFixedCode && fixedCode ? (
                        <pre>
                          <code className="text-emerald-50">
                            {fixedCode.split('\n').map((line, i) => (
                              <div key={i} className="flex hover:bg-emerald-500/5 transition-colors">
                                <span className="text-emerald-500/50 w-10 inline-block select-none text-right pr-3 border-r border-emerald-500/20 mr-3">{i + 1}</span>
                                <span>{line || ' '}</span>
                              </div>
                            ))}
                          </code>
                        </pre>
                      ) : (
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
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="bg-surface-container-lowest w-full py-stack-lg border-t border-outline-variant/20 mt-auto md:ml-64 w-auto z-30">
        <div className="max-w-container-max mx-auto px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-4">
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</a>
            <a className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </>
  )
}
