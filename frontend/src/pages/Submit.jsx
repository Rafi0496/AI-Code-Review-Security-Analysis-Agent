import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsAPI, submissionsAPI, reviewsAPI } from '../api/client'

const DEMO_CODE = `import sqlite3

# DEMO: Intentionally vulnerable Python code for testing
def get_user(username, password):
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # SQL Injection vulnerability
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor.execute(query)
    user = cursor.fetchone()
    
    # Hardcoded secret
    API_KEY = "sk-prod-abc123xyz789secret"
    
    if user:
        return {"status": "success", "api_key": API_KEY}
    return {"status": "failed"}

def execute_command(cmd):
    import os
    # Command injection vulnerability
    os.system("ping " + cmd)

class UserManager:
    def __init__(self):
        self.users = {}
        self.admin_password = "admin123"  # Hardcoded credential
    
    def add_user(self, name, data, data2, data3, data4, data5, data6):
        # Too many parameters - design smell
        pass
    
    def process(self, x):
        # Poor naming, magic numbers
        if x > 42:
            return x * 3.14159 + 100
`

export default function Submit() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState('')
  const [filename, setFilename] = useState('')
  const [mode, setMode] = useState('paste') // 'paste' | 'upload'
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const [agentStatus, setAgentStatus] = useState(null)

  useEffect(() => {
    projectsAPI.list().then(res => {
      setProjects(res.data)
      if (res.data.length > 0) setSelectedProject(res.data[0].id)
    }).catch(() => {})
  }, [])

  const createProject = async () => {
    if (!newProjectName.trim()) return
    const res = await projectsAPI.create({ name: newProjectName })
    setProjects(p => [...p, res.data])
    setSelectedProject(res.data.id)
    setNewProjectName('')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFilename(file.name)
    const ext = file.name.split('.').pop().toLowerCase()
    const langMap = { py: 'python', java: 'java', js: 'javascript', ts: 'typescript' }
    if (langMap[ext]) setLanguage(langMap[ext])

    const reader = new FileReader()
    reader.onload = (ev) => setCode(ev.target.result)
    reader.readAsText(file)
  }

  const handleSubmitAndAnalyze = async () => {
    if (!selectedProject) { setError('Please select or create a project first'); return }
    if (!code.trim()) { setError('Please paste or upload some code'); return }

    setError('')
    setAnalyzing(true)
    setAgentStatus({ stage: 1, message: '🔍 Code Analysis Agent running...' })

    try {
      // Submit code
      const subRes = await submissionsAPI.submit({
        project_id: selectedProject,
        source_code: code,
        language,
        filename: filename || `code.${language === 'python' ? 'py' : language === 'java' ? 'java' : language === 'javascript' ? 'js' : 'ts'}`,
      })
      const submissionId = subRes.data.id

      setTimeout(() => setAgentStatus({ stage: 2, message: '🛡️ Security Vulnerability Agent scanning...' }), 100)

      // Trigger synchronous analysis
      const reviewRes = await reviewsAPI.analyze(submissionId)
      const reviewId = reviewRes.data.review_id

      navigate(`/review/${reviewId}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.')
      setAnalyzing(false)
      setAgentStatus(null)
    }
  }

  if (analyzing) {
    return (
      <div className="page-content">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '2rem' }}>
          <div style={{ fontSize: '3rem', animation: 'pulse-glow 2s ease infinite' }}>🤖</div>
          <h2>AI Agents Analyzing Your Code</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 500 }}>
            The multi-agent pipeline is running. This may take 30–60 seconds for a thorough analysis.
          </p>
          {[
            '🔍 Code Analysis Agent — Evaluating quality and smells',
            '🛡️ Security Agent — Scanning for OWASP vulnerabilities',
            '🔧 Remediation Agent — Generating fix recommendations',
            '📋 PR Summary Agent — Compiling review report',
          ].map((stage, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 500, border: '1px solid var(--border-subtle)' }}>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{stage}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Submit Code for Review</h1>
        <p>Paste code or upload a file — our 4 AI agents will analyze it automatically</p>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <div className="grid-2">
        {/* Left: Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Project */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📁 Project</h3>
            <div className="form-group">
              <label className="form-label">Select Project</label>
              <select className="select" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                <option value="">-- Choose a project --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input className="input" placeholder="New project name..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={createProject}>+ Create</button>
            </div>
          </div>

          {/* Language */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>🌐 Language</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {['python', 'java', 'javascript', 'typescript'].map(lang => (
                <button key={lang} className={`btn ${language === lang ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLanguage(lang)}>
                  {lang === 'python' ? '🐍' : lang === 'java' ? '☕' : lang === 'javascript' ? '🟨' : '🔷'} {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Submission Mode */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>📤 Submission Mode</h3>
            <div className="tabs" style={{ marginBottom: '1rem' }}>
              <button className={`tab ${mode === 'paste' ? 'active' : ''}`} onClick={() => setMode('paste')}>Paste Code</button>
              <button className={`tab ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>Upload File</button>
            </div>
            {mode === 'upload' && (
              <div style={{ border: '2px dashed var(--border-default)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center' }}>
                <input type="file" id="file-upload" accept=".py,.java,.js,.ts" onChange={handleFileUpload} style={{ display: 'none' }} />
                <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📎</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {filename ? <span style={{ color: 'var(--severity-low)' }}>✅ {filename}</span> : 'Click to upload .py, .java, .js, .ts'}
                  </div>
                </label>
              </div>
            )}
          </div>

          <button className="btn btn-primary btn-lg" onClick={handleSubmitAndAnalyze} style={{ justifyContent: 'center' }}>
            🚀 Analyze with AI Agents
          </button>
        </div>

        {/* Right: Code Editor */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label className="form-label">Source Code</label>
            <button className="btn btn-ghost btn-sm" onClick={() => setCode(DEMO_CODE)}>Load Demo Code</button>
          </div>
          <div className="code-editor-wrapper">
            <div className="code-editor-header">
              <div className="code-editor-dots">
                <div className="code-dot code-dot-red" />
                <div className="code-dot code-dot-yellow" />
                <div className="code-dot code-dot-green" />
              </div>
              <span className="code-editor-lang">{language}</span>
            </div>
            <textarea
              className="code-textarea"
              placeholder={`# Paste your ${language} code here...\n# Or click "Load Demo Code" to try a vulnerable example`}
              value={code}
              onChange={e => setCode(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <span>{code.split('\n').length} lines</span>
            <span>{code.length} characters</span>
          </div>
        </div>
      </div>
    </div>
  )
}
