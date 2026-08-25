import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import ReactMarkdown from 'react-markdown'
import Prism from 'prismjs'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import './styles/index.css'
import { api } from './api/client'

const SEV_CLS = { Critical: 'risk-critical', High: 'risk-high', Medium: 'risk-medium', Low: 'risk-low' }
const sevCls = (s) => SEV_CLS[s] ?? 'risk-low'
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const detectLanguage = (code) => {
  if (!code) return 'python'
  if (/public\s+class\s+|import\s+java\.|System\.out\.println/.test(code)) {
    return 'java'
  }
  if (/(?:const|let|var)\s+\w+\s*=|function\s*\w*\(|import\s+.*\s+from\s+['"]|export\s+(?:default\s+)?/.test(code)) {
    return 'javascript'
  }
  if (/interface\s+\w+|type\s+\w+\s*=|:\s*(?:string|number|boolean|any)\b/.test(code)) {
    return 'typescript'
  }
  if (/#include\s+<.*>|int\s+main\s*\(/.test(code)) {
    return 'cpp'
  }
  if (/SELECT\s+.*\s+FROM|CREATE\s+TABLE|INSERT\s+INTO/i.test(code)) {
    return 'sql'
  }
  return 'python'
}

function highlightCode(code, language = 'python') {
  if (!code) return ''
  const langKey = (language || 'python').toLowerCase()
  let grammar = Prism.languages[langKey]
  let prismLang = langKey

  if (!grammar) {
    if (langKey === 'py' || langKey === 'python3') {
      grammar = Prism.languages.python
      prismLang = 'python'
    } else if (langKey === 'js') {
      grammar = Prism.languages.javascript
      prismLang = 'javascript'
    } else if (langKey === 'ts') {
      grammar = Prism.languages.typescript
      prismLang = 'typescript'
    } else if (langKey === 'c++') {
      grammar = Prism.languages.cpp
      prismLang = 'cpp'
    } else {
      grammar = Prism.languages.python || Prism.languages.javascript
      prismLang = 'python'
    }
  }

  try {
    return Prism.highlight(code, grammar, prismLang)
  } catch (err) {
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

function applyClientDeterministicFixes(code, language = 'python') {
  if (!code) return ''
  let fixed = code
  const lang = (language || 'python').toLowerCase()

  if (lang === 'python' || lang === 'py') {
    const headers = []
    if (!fixed.includes('os.getenv') && /(?:password|secret|api_key|token|db_password|admin_password)\s*=\s*["']/i.test(fixed)) {
      if (!fixed.includes('import os')) headers.push('import os')
    }
    if (!fixed.includes('subprocess.run') && (fixed.includes('os.system') || fixed.includes('subprocess.call') || fixed.includes('cmd ='))) {
      if (!fixed.includes('import subprocess')) headers.push('import subprocess')
    }

    if (headers.length > 0) {
      fixed = headers.join('\n') + '\n\n' + fixed
    }

    // Fix hardcoded credentials
    fixed = fixed.replace(/([A-Za-z0-9_]*(?:PASSWORD|SECRET|API_KEY|TOKEN|SECRET_KEY|AUTH_KEY)[A-Za-z0-9_]*)\s*=\s*(["'][^"']+["'])/gi, (match, varName) => {
      return `${varName} = os.getenv("${varName.toUpperCase()}", "PLACEHOLDER_SECURE_TOKEN")`
    })

    // Fix debug/verify flags
    fixed = fixed.replace(/DEBUG\s*=\s*True/gi, 'DEBUG = False')
    fixed = fixed.replace(/verify\s*=\s*False/gi, 'verify = True')

    // Fix bare except
    fixed = fixed.replace(/except\s*:/g, 'except Exception as e:')

    // Fix SQL Injection
    fixed = fixed.replace(/query\s*=\s*["']SELECT\s+([^"']+)WHERE\s+([A-Za-z0-9_]+)=[^;\n\r]+/g, 'query = "SELECT $1WHERE $2=?"')
    fixed = fixed.replace(/cursor\.execute\(query\)/g, 'cursor.execute(query, (username,))')
    fixed = fixed.replace(/cursor\.execute\(["']SELECT\s+([^"']+)WHERE\s+([A-Za-z0-9_]+)=[^,\)]+\)/g, 'cursor.execute("SELECT $1WHERE $2=?", (username,))')

    // Fix Command Injection
    fixed = fixed.replace(/cmd\s*=\s*["']ping\s+["']\s*\+\s*(\w+)/g, '# Secure subprocess execution\n    subprocess.run(["ping", $1], check=True)')
    fixed = fixed.replace(/os\.system\(cmd\)/g, '# Replaced vulnerable os.system with secure subprocess')
    fixed = fixed.replace(/os\.system\(["']ping\s+["']\s*\+\s*(\w+)\)/g, 'subprocess.run(["ping", $1], check=True)')
    fixed = fixed.replace(/os\.system\(f["']ping\s+\{([^\}]+)\}\s*["']\)/g, 'subprocess.run(["ping", $1], check=True)')
  } else if (lang === 'java') {
    fixed = fixed.replace(/String\s+(password|secret|apiKey|api_key|token)\s*=\s*["'][^"']+["'];/gi, 'String $1 = System.getenv("$1".toUpperCase());')
    fixed = fixed.replace(/Statement\s+(\w+)\s*=\s*conn\.createStatement\(\);/g, '// Use PreparedStatement instead of Statement for parameterized SQL\n        PreparedStatement $1 = conn.prepareStatement("SELECT * FROM users WHERE id = ?");')
  }

  return fixed
}

function CodeEditor({ value, onChange, language = 'python', placeholder = '' }) {
  const textareaRef = useRef(null)
  const preRef = useRef(null)
  const lineNumbersRef = useRef(null)

  const highlightedHtml = useMemo(() => {
    return highlightCode(value, language)
  }, [value, language])

  const lines = useMemo(() => {
    return value.split('\n')
  }, [value])

  const handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.target
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop
      preRef.current.scrollLeft = scrollLeft
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      if (e.shiftKey) {
        const before = value.substring(0, start)
        const lineStart = before.lastIndexOf('\n') + 1
        const line = value.substring(lineStart, start)
        if (line.startsWith('    ')) {
          const newValue = value.substring(0, lineStart) + line.substring(4) + value.substring(start)
          onChange(newValue)
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4)
          }, 0)
        }
      } else {
        const newValue = value.substring(0, start) + '    ' + value.substring(end)
        onChange(newValue)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 4
        }, 0)
      }
    } else if (e.key === 'Enter') {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const before = value.substring(0, start)
      const lastLine = before.substring(before.lastIndexOf('\n') + 1)
      const indentMatch = lastLine.match(/^(\s+)/)
      if (indentMatch && indentMatch[1]) {
        e.preventDefault()
        let extraIndent = indentMatch[1]
        if (lastLine.trim().endsWith(':') || lastLine.trim().endsWith('{')) {
          extraIndent += '    '
        }
        const newValue = value.substring(0, start) + '\n' + extraIndent + value.substring(textarea.selectionEnd)
        onChange(newValue)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1 + extraIndent.length
        }, 0)
      }
    }
  }

  return (
    <div className="flex bg-[#16161e] border-t border-white/5 min-h-[420px] max-h-[620px] relative rounded-b-xl overflow-hidden font-mono text-[13.5px]">
      {/* Line Numbers Column */}
      <div 
        ref={lineNumbersRef} 
        className="py-4 px-3 text-[#565f89] select-none text-right min-w-[46px] bg-[#13131a] border-r border-white/5 font-mono text-[13.5px] leading-[22px] overflow-hidden"
      >
        {lines.map((_, i) => (
          <div key={i} className="h-[22px] leading-[22px]">{i + 1}</div>
        ))}
      </div>

      {/* Editor Main Container */}
      <div className="relative flex-1 min-h-[420px] max-h-[620px] overflow-hidden bg-[#16161e]">
        {/* Highlight Layer */}
        <pre
          ref={preRef}
          className="syntax-highlight-layer code-editor-font absolute inset-0 p-4 m-0 pointer-events-none overflow-hidden whitespace-pre tab-size-4 select-none"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ 
            __html: highlightedHtml + (value.endsWith('\n') ? '\n ' : '') 
          }}
        />

        {/* Interactive Textarea Layer */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="code-editor-textarea code-editor-font absolute inset-0 p-4 m-0 bg-transparent text-transparent caret-cyan-400 border-none outline-none resize-none overflow-auto whitespace-pre tab-size-4 z-10 selection:bg-indigo-600/35 selection:text-transparent"
        />
      </div>
    </div>
  )
}

const formatLanguageDisplay = (lang) => {
  if (!lang) return 'Source'
  const l = (lang || '').toLowerCase().trim()
  const map = {
    python: 'Python',
    py: 'Python',
    python3: 'Python',
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    java: 'Java',
    cpp: 'C++',
    'c++': 'C++',
    c: 'C',
    csharp: 'C#',
    'c#': 'C#',
    sql: 'SQL',
    bash: 'Bash',
    sh: 'Shell',
    shell: 'Shell',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    go: 'Go',
    rust: 'Rust',
    php: 'PHP',
    ruby: 'Ruby'
  }
  return map[l] || (l.charAt(0).toUpperCase() + l.slice(1))
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

function calculateHealthScore(breakdown = {}) {
  const crit = breakdown.Critical || 0
  const high = breakdown.High || 0
  const med = breakdown.Medium || 0
  const low = breakdown.Low || 0
  const penalty = (crit * 18) + (high * 9) + (med * 4) + (low * 1)
  if (penalty === 0) return 100
  const decay = 100 / (1 + Math.pow(penalty / 45, 0.9))
  return Math.max(5, Math.min(98, Math.round(decay)))
}

function generateCodeTitle(code, language = 'python', filename = '') {
  if (filename && filename !== 'uploaded_code' && filename !== 'paste_buffer' && filename.trim() !== '') {
    return filename.trim()
  }
  if (!code || !code.trim()) return 'Untitled Code Snippet'

  const lines = code.split('\n').map(l => l.trim()).filter(Boolean)
  
  // 1. Check for leading comments or title docstrings
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i]
    if (l.startsWith('//') || l.startsWith('#') || l.startsWith('/*') || l.startsWith('*')) {
      const cleaned = l.replace(/^(\/\/|#|\/\*|\*)\s*/, '').replace(/\*\/$/, '').trim()
      if (cleaned.length >= 4 && cleaned.length <= 60 && !cleaned.toLowerCase().startsWith('todo') && !cleaned.toLowerCase().startsWith('fixme') && !cleaned.startsWith('!/usr/bin')) {
        return cleaned
      }
    }
  }

  // 2. Check for Class definitions
  const classMatch = code.match(/(?:export\s+)?(?:public\s+|private\s+|protected\s+)?class\s+([A-Za-z0-9_]+)/)
  if (classMatch && classMatch[1]) {
    return `Class ${classMatch[1]}`
  }

  // 3. Check for API routes / decorators
  const routeMatch = code.match(/@(?:app|router)\.(?:get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i) || code.match(/(?:app|router)\.(?:get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/i)
  if (routeMatch && routeMatch[1]) {
    return `Route ${routeMatch[1]}`
  }

  // 4. Check for Main / primary functions
  const funcMatch = code.match(/(?:async\s+def|def|function|const|let)\s+([A-Za-z0-9_]+)\s*(?:=\s*(?:async\s*)?\([^)]*\)\s*=>|\()/i)
  if (funcMatch && funcMatch[1] && !['main', 'test', 'init', '__init__'].includes(funcMatch[1].toLowerCase())) {
    return `${funcMatch[1]}()`
  }

  // 5. Check for SQL Table or Query
  if ((language || '').toLowerCase() === 'sql' || /CREATE\s+TABLE|SELECT\s+/i.test(code)) {
    const tableMatch = code.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)/i) || code.match(/FROM\s+([A-Za-z0-9_]+)/i)
    if (tableMatch && tableMatch[1]) {
      return `SQL Query: ${tableMatch[1]}`
    }
    return `SQL Database Script`
  }

  // 6. Descriptive fallback
  const firstMeaningful = lines.find(l => !l.startsWith('//') && !l.startsWith('#') && !l.startsWith('import ') && !l.startsWith('from '))
  if (firstMeaningful && firstMeaningful.length <= 40) {
    return `${firstMeaningful.slice(0, 35)} (${formatLanguageDisplay(language)})`
  }

  const lineCount = lines.length
  return `${formatLanguageDisplay(language)} Script (${lineCount} line${lineCount !== 1 ? 's' : ''})`
}

function generateMarkdownReport(item) {
  const findings = item.findings || []
  const sev = item.summary?.severity_breakdown || {}
  const pr = item.prReport || {}
  
  let md = `# Aegis AI — Code Security & Health Analysis Report\n\n`
  md += `**Target:** ${item.title || 'Code Review'}  \n`
  md += `**Language:** ${formatLanguageDisplay(item.language)}  \n`
  md += `**Scan Timestamp:** ${item.formattedTime || new Date(item.timestamp).toLocaleString()}  \n`
  md += `**Code Health Score:** ${item.healthScore ?? '—'}/100  \n`
  md += `**Risk Level:** ${item.summary?.risk_level || 'Unknown'}  \n`
  md += `**Estimated Remediation:** ${pr.estimated_fix_time || '15 mins'}  \n\n`
  
  md += `## 1. Executive Summary\n`
  md += `${pr.executive_overview || `Multi-agent static and dynamic analysis detected ${findings.length} issue(s) across the submitted codebase.`}\n\n`
  
  md += `## 2. Vulnerability Breakdown\n`
  md += `- **Critical (Blockers):** ${sev.Critical || 0}\n`
  md += `- **High:** ${sev.High || 0}\n`
  md += `- **Medium:** ${sev.Medium || 0}\n`
  md += `- **Low:** ${sev.Low || 0}\n\n`
  
  if (findings.length > 0) {
    md += `## 3. Key Findings & Remediation Steps\n`
    findings.forEach((f, idx) => {
      md += `### ${idx + 1}. [${(f.severity || 'Medium').toUpperCase()}] ${f.type || 'Issue'} (Line ${f.line || 'N/A'})\n`
      md += `- **Description:** ${f.description || 'No description provided'}\n`
      md += `- **Recommendation:** ${f.recommendation || f.fix_summary || 'Review and remediate according to OWASP / security best practices'}\n`
      if (f.before_code) {
        md += `\`\`\`${item.language || 'text'}\n// Vulnerable (Line ${f.line || 'N/A'})\n${f.before_code}\n\`\`\`\n`
      }
      if (f.after_code) {
        md += `\`\`\`${item.language || 'text'}\n// Secured Remediation\n${f.after_code}\n\`\`\`\n`
      }
      md += `\n`
    })
  }
  
  if (item.fixedCode) {
    md += `## 4. Full Remediated Source Code\n`
    md += `\`\`\`${item.language || 'python'}\n${item.fixedCode}\n\`\`\`\n\n`
  }
  
  md += `---\n*Generated by Aegis AI Multi-Agent Security Engine.*\n`
  return md
}

function downloadPDF(prData, fullFixedCode, submittedCode, language = 'python', findingsList = []) {
  const formattedLang = formatLanguageDisplay(language)
  const allFindings = findingsList && findingsList.length > 0 
    ? findingsList 
    : (prData.detailed_findings || prData.prioritized_fix_list || [])

  const effectiveFixedCode = fullFixedCode || prData.full_fixed_code || applyClientDeterministicFixes(submittedCode, language) || '// No code provided'

  // Generate detailed error and fix breakdown for every finding
  const errorAndFixCards = allFindings.map((f, i) => {
    const sev = (f.severity || 'Medium').toUpperCase()
    const issueType = (f.type || f.finding_type || f.title || 'Security Defect').toUpperCase()
    const lineNum = f.line || f.line_number || 'N/A'
    const desc = f.description || f.impact || 'Defect identified during automated static and heuristic analysis.'
    const recommendation = f.recommendation || f.fix_summary || f.action_required || 'Review source implementation and apply standard security mitigations.'

    // Determine deep root cause and threat impact based on issue type
    let rootCause = ''
    let threatImpact = ''
    let detailedAction = recommendation

    const typeLower = (f.type || f.title || '').toLowerCase()
    if (typeLower.includes('sql') || typeLower.includes('injection')) {
      rootCause = 'Dynamic string concatenation is used to construct database queries with untrusted user input, allowing attackers to manipulate the SQL syntax tree and execute arbitrary database commands.'
      threatImpact = 'Critical Risk: Unauthorized reading of database records, extraction of user credentials, bypassing authentication filters, or data destruction.'
      if (!recommendation || recommendation.length < 25) {
        detailedAction = 'Refactor query execution to utilize parameterized queries or prepared statements. Never concatenate user input directly into SQL strings. Bind variables securely at runtime.'
      }
    } else if (typeLower.includes('secret') || typeLower.includes('credential') || typeLower.includes('password') || typeLower.includes('api_key') || typeLower.includes('token')) {
      rootCause = 'Plaintext sensitive credentials (API keys, database passwords, or cryptographic tokens) are statically hardcoded into the source code.'
      threatImpact = 'Critical Risk: Hardcoded credentials committed to version control can be discovered by unauthorized users or attackers, compromising external services and databases.'
      if (!recommendation || recommendation.length < 25) {
        detailedAction = 'Remove plaintext secrets immediately. Store credentials securely in system environment variables or a secrets manager, and access them dynamically via os.getenv() or equivalent.'
      }
    } else if (typeLower.includes('command') || typeLower.includes('os.system') || typeLower.includes('subprocess')) {
      rootCause = 'External operating system commands are invoked via a shell wrapper with concatenated user arguments without strict parameter separation or sanitization.'
      threatImpact = 'Critical Risk: Remote Code Execution (RCE), host compromise, unauthorized access to host file system, and potential server takeover.'
      if (!recommendation || recommendation.length < 25) {
        detailedAction = 'Eliminate shell execution wrappers (avoid os.system and shell=True). Use subprocess.run() passing arguments as an explicit, structured list of tokens.'
      }
    } else if (typeLower.includes('bare except') || typeLower.includes('except') || typeLower.includes('error handling')) {
      rootCause = 'A broad, unqualified `except:` clause catches all exceptions indiscriminately, including SystemExit, KeyboardInterrupt, and unforeseen memory or runtime errors.'
      threatImpact = 'Medium Risk: Masking underlying programming errors, preventing graceful process termination, and complicating error tracing in production environments.'
      if (!recommendation || recommendation.length < 25) {
        detailedAction = 'Catch specific exception types explicitly (e.g., `except Exception as e:` or specific domain errors such as `ValueError`, `KeyError`) and log the exception details.'
      }
    } else if (typeLower.includes('parameter') || typeLower.includes('complexity') || typeLower.includes('code smell')) {
      rootCause = 'Function signature defines an excessive number of parameters, increasing cognitive load, coupling, and likelihood of caller misuse.'
      threatImpact = 'Low to Medium Risk: Decreased code maintainability, high regression risk during modifications, and violation of Clean Code modularity principles.'
      if (!recommendation || recommendation.length < 25) {
        detailedAction = 'Encapsulate related parameters into a dedicated data structure, configuration object, or typed dictionary to simplify the interface.'
      }
    } else {
      rootCause = `The source logic deviates from secure coding standards and static analysis heuristics near Line ${lineNum}.`
      threatImpact = `Potential security or maintainability defect classified under ${sev} severity level.`
    }

    const beforeSnippet = f.before_code || (f.code_example ? f.code_example : null)
    const afterSnippet = f.after_code || (f.corrected_code ? f.corrected_code : null)

    return `
    <div class="defect-card-item" style="margin-bottom: 28px; border: 1.5px solid #000; padding: 22px; background: #fff; page-break-inside: avoid; font-family: 'Times New Roman', Times, serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #000; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="font-size: 15.5px; font-weight: bold; text-transform: uppercase; color: #000;">
          ISSUE #${i + 1}: ${issueType}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="border: 1.5px solid #000; background: #000; color: #fff; font-weight: bold; font-size: 11px; padding: 4px 10px; text-transform: uppercase; letter-spacing: 0.05em;">${sev}</span>
          <span style="border: 1.5px solid #000; background: #fff; color: #000; font-weight: bold; font-size: 11px; padding: 4px 10px;">LINE ${lineNum}</span>
        </div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 4px;">1. Defect Description:</div>
        <div style="font-size: 14.5px; color: #111; line-height: 1.7;">${desc}</div>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 4px;">2. Root Cause Analysis:</div>
        <div style="font-size: 14.5px; color: #111; line-height: 1.7;">${rootCause}</div>
      </div>

      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 4px;">3. Security & Operational Impact:</div>
        <div style="font-size: 14.5px; color: #111; line-height: 1.7;">${threatImpact}</div>
      </div>

      <div style="border: 1.5px solid #000; background: #f9f9f9; padding: 14px 16px; margin-top: 14px;">
        <div style="font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 5px;">4. Actionable Remediation & Fix Instructions:</div>
        <div style="font-size: 14.5px; color: #111; line-height: 1.7;">${detailedAction}</div>
      </div>

      ${beforeSnippet || afterSnippet ? `
      <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        ${beforeSnippet ? `
        <div style="border: 1.5px solid #000; background: #fff;">
          <div style="background: #000; color: #fff; padding: 5px 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; font-family: 'Times New Roman', Times, serif;">VULNERABLE CODE (BEFORE)</div>
          <pre style="margin: 0; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #000; white-space: pre-wrap; line-height: 1.55;">${beforeSnippet}</pre>
        </div>` : ''}
        ${afterSnippet ? `
        <div style="border: 1.5px solid #000; background: #fff;">
          <div style="background: #000; color: #fff; padding: 5px 10px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; font-family: 'Times New Roman', Times, serif;">SECURE REMEDIATION (AFTER)</div>
          <pre style="margin: 0; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #000; white-space: pre-wrap; line-height: 1.55;">${afterSnippet}</pre>
        </div>` : ''}
      </div>` : ''}
    </div>`
  }).join('')

  const fixedCodeLines = effectiveFixedCode.split('\n').map((line, idx) => {
    return `<tr><td style="width: 50px; text-align: right; color: #444; padding: 3px 10px; border: none; border-right: 1.5px solid #000; user-select: none; background: #f0f0f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px;">${idx + 1}</td><td style="padding: 3px 10px; border: none; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12.5px; white-space: pre; color: #000;">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || ' '}</td></tr>`
  }).join('')

  const rawFixedCodeEscaped = JSON.stringify(effectiveFixedCode)

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Report of Uploaded ${formattedLang} Code</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    color: #111;
    padding: 48px;
    line-height: 1.75;
    font-size: 14.5px;
    background: #fff;
  }
  .report-header {
    border-bottom: 2.5px solid #000;
    padding-bottom: 20px;
    margin-bottom: 32px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-content {
    flex: 1;
    text-align: center;
  }
  h1.main-heading {
    font-family: "Times New Roman", Times, serif;
    font-size: 26px;
    font-weight: bold;
    text-align: center;
    color: #000;
    margin: 0 auto 10px auto;
    letter-spacing: 0.02em;
  }
  .meta {
    font-family: "Times New Roman", Times, serif;
    font-size: 13.5px;
    color: #333;
    margin-top: 8px;
    text-align: center;
    line-height: 1.6;
  }
  .action-bar { display: flex; gap: 8px; }
  .btn-action {
    font-family: "Times New Roman", Times, serif;
    background: #000;
    color: #fff;
    border: 1.5px solid #000;
    padding: 8px 18px;
    font-size: 12.5px;
    font-weight: bold;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .btn-action:hover { background: #333; }
  h2 {
    font-family: "Times New Roman", Times, serif;
    font-size: 18px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 36px 0 16px;
    color: #000;
    border-bottom: 1.5px solid #000;
    padding-bottom: 6px;
  }
  .score-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin: 20px 0 32px; }
  .score-card { border: 1.5px solid #000; padding: 18px 14px; text-align: center; background: #fff; }
  .score-val { font-family: "Times New Roman", Times, serif; font-size: 28px; font-weight: bold; color: #000; display: block; }
  .score-lbl { font-family: "Times New Roman", Times, serif; font-size: 12px; color: #333; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; margin-top: 6px; display: block; }
  table.stats-table { width: 100%; border-collapse: collapse; margin: 16px 0 28px; font-family: "Times New Roman", Times, serif; }
  table.stats-table th, table.stats-table td { text-align: left; padding: 11px 16px; border: 1.5px solid #000; font-size: 14px; color: #000; line-height: 1.6; }
  table.stats-table th { background: #f2f2f2; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; }
  .code-container { border: 1.5px solid #000; background: #fff; margin-top: 16px; margin-bottom: 24px; }
  .code-table { width: 100%; border-collapse: collapse; margin: 0; }
  .footer { margin-top: 48px; padding-top: 18px; border-top: 1.5px solid #000; font-size: 12.5px; color: #333; display: flex; justify-content: space-between; font-family: "Times New Roman", Times, serif; font-weight: bold; }
  
  @media print {
    body { padding: 25px; line-height: 1.8; }
    .no-print { display: none !important; }
    .score-card, table.stats-table, .code-container { page-break-inside: avoid; }
    .defect-card-item { page-break-inside: avoid !important; margin-bottom: 28px !important; }
  }
</style>
</head><body>
<div class="report-header">
  <div class="header-content">
    <h1 class="main-heading">Aegis AI Security Analysis & PR Report</h1>
    <div class="meta">
      <strong>Generated:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })} &bull; 
      <strong>System:</strong> Aegis AI Multi-Agent Security Engine &bull; 
      <strong>Target Language:</strong> ${formattedLang}
    </div>
  </div>
  <div class="action-bar no-print" style="margin-left: 16px;">
    <button class="btn-action" onclick="window.print()">Print / Save PDF</button>
  </div>
</div>

<h2>1. Executive Overview & Code Health Assessment</h2>
<p style="margin-bottom: 18px; color: #111; font-size: 14.5px; line-height: 1.75;">${prData.executive_overview || 'Comprehensive multi-agent code analysis completed. Findings, technical root causes, and full code remediation are documented below.'}</p>

<div class="score-row">
  <div class="score-card">
    <span class="score-val">${prData.code_health_score ?? '—'}/100</span>
    <span class="score-lbl">Code Health Score</span>
  </div>
  <div class="score-card">
    <span class="score-val">${prData.risk_level || (prData.severity_breakdown?.Critical > 0 ? 'CRITICAL' : prData.severity_breakdown?.High > 0 ? 'HIGH' : 'MODERATE')}</span>
    <span class="score-lbl">Overall Risk Classification</span>
  </div>
  <div class="score-card">
    <span class="score-val">${prData.estimated_fix_time || '15 mins'}</span>
    <span class="score-lbl">Est. Remediation Effort</span>
  </div>
</div>

<h2>2. Vulnerability Severity Breakdown</h2>
<table class="stats-table">
  <tr><th>Severity Level</th><th>Identified Count</th><th>Resolution SLA & Policy</th></tr>
  <tr><td><strong>CRITICAL</strong></td><td>${prData.severity_breakdown?.Critical ?? 0}</td><td>Immediate exploitation risk — Blocking issue; fix required prior to merge</td></tr>
  <tr><td><strong>HIGH</strong></td><td>${prData.severity_breakdown?.High ?? 0}</td><td>Significant security or stability concern — Resolve within 24 hours</td></tr>
  <tr><td><strong>MEDIUM</strong></td><td>${prData.severity_breakdown?.Medium ?? 0}</td><td>Code smell or performance degradation — Resolve within current iteration</td></tr>
  <tr><td><strong>LOW</strong></td><td>${prData.severity_breakdown?.Low ?? 0}</td><td>Minor improvement or style guideline — Address during routine maintenance</td></tr>
</table>

<h2>3. Comprehensive Defect Analysis & Error Fixes</h2>
<p style="color: #333; font-size: 13.5px; margin-bottom: 18px;">Detailed technical breakdown for every identified defect, including root cause, impact, and exact code fix:</p>
${errorAndFixCards || '<p style="color: #000; font-size: 14.5px;">No defects identified in submitted codebase.</p>'}

<h2>4. Full Remediated Source Code (Fixed Codebase)</h2>
<p style="color: #333; font-size: 13.5px; margin-bottom: 12px;">The complete corrected source code with all vulnerabilities resolved and secure coding standards implemented:</p>
<div class="code-container">
  <div style="background: #f0f0f0; border-bottom: 1.5px solid #000; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-family: 'Times New Roman', Times, serif;">
    <span style="font-size: 12.5px; font-weight: bold; text-transform: uppercase;">📄 SECURED SOURCE CODE (${formattedLang})</span>
    <button id="copy-btn" class="btn-action no-print" onclick="copyFixedCode()" style="padding: 5px 12px; font-size: 11.5px;">📋 Copy Fixed Code</button>
  </div>
  <table class="code-table">
    <tbody>
      ${fixedCodeLines}
    </tbody>
  </table>
</div>

${prData.positive_observations?.length > 0 ? `
<h2>5. Positive Observations & Best Practices</h2>
<ul style="margin: 12px 0 12px 28px; color: #111; font-size: 14.5px; line-height: 1.75;">
  ${prData.positive_observations.map(o => `<li style="margin-bottom: 8px;">${o}</li>`).join('')}
</ul>` : ''}

<div class="footer">
  <span>Aegis AI — Code Security & Health Analysis Platform</span>
  <span>Automated Multi-Agent Verification Audit</span>
</div>

<script>
  function copyFixedCode() {
    const code = ${rawFixedCodeEscaped};
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-btn');
        if (btn) {
          const orig = btn.innerText;
          btn.innerText = '✓ COPIED TO CLIPBOARD!';
          setTimeout(() => {
            btn.innerText = orig;
          }, 2000);
        }
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Fixed code copied to clipboard!');
    }
  }
</script>
</body></html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 300)
    }
  }
}

const ChatWidget = ({ currentCode, currentFindings }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [chatMode, setChatMode] = useState('popup')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const toggleMode = (mode) => setChatMode(prev => prev === mode ? 'popup' : mode)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isOpen])

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return
    const userMsg = input.trim()
    setInput('')
    const history = [...messages]
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setIsLoading(true)
    
    try {
      const res = await api.chat(userMsg, currentCode, currentFindings, history)
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer, code_example: res.code_example }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't connect to the AI. Please try again." }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`fixed z-50 flex flex-col items-end transition-all duration-300 ${chatMode === 'popup' ? 'bottom-6 right-6' : 'top-20 right-0 h-[calc(100vh-80px)]'} ${chatMode === 'fullscreen' ? 'w-full' : chatMode === 'split' ? 'w-1/2' : ''}`}>
      {isOpen && (
        <div className={`bg-surface-container-low/95 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 transition-all duration-300 ${chatMode === 'popup' ? 'rounded-2xl mb-4 w-[350px] sm:w-[400px] h-[500px]' : 'rounded-l-2xl w-full h-full'}`}>
          <div className="bg-surface-dim/80 backdrop-blur-xl p-4 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>smart_toy</span>
              <h3 className="font-semibold text-on-surface tracking-wide">Lyca AI</h3>
            </div>
            <div className="flex gap-3">
              <button onClick={() => toggleMode('split')} className={`text-outline-variant hover:text-white transition-colors ${chatMode==='split'?'text-primary':''}`} title="Split Screen">
                <span className="material-symbols-outlined" style={{fontSize:'20px'}}>vertical_split</span>
              </button>
              <button onClick={() => toggleMode('fullscreen')} className={`text-outline-variant hover:text-white transition-colors ${chatMode==='fullscreen'?'text-primary':''}`} title="Full Screen">
                <span className="material-symbols-outlined" style={{fontSize:'20px'}}>fullscreen</span>
              </button>
              <button onClick={() => { setIsOpen(false); setChatMode('popup') }} className="text-outline-variant hover:text-white transition-colors">
                <span className="material-symbols-outlined" style={{fontSize:'20px'}}>close</span>
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-surface-container-lowest">
            {messages.length === 0 && (
              <div className="text-center text-outline-variant mt-8 text-sm">
                Hi! Ask me anything about your code, security, or just chat!
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col max-w-[90%] ${m.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                {m.role === 'user' ? (
                  <div className="p-3 rounded-2xl text-sm bg-primary text-on-primary rounded-tr-sm whitespace-pre-wrap">
                    {m.content}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl text-sm bg-surface-container text-on-surface border border-white/10 rounded-tl-sm text-gray-200 leading-relaxed overflow-x-auto w-full">
                    <ReactMarkdown
                      components={{
                        pre: ({node, ...props}) => <pre className="bg-[#0f0f14] p-3 rounded-xl border border-white/10 overflow-x-auto my-2 text-xs font-mono text-emerald-400" {...props} />,
                        code: ({node, inline, ...props}) => inline ? <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-primary font-mono" {...props} /> : <code {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-4 my-2 space-y-1.5" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-4 my-2 space-y-1.5" {...props} />,
                        li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                        p: ({node, ...props}) => <p className="mb-2.5 last:mb-0" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-base font-bold text-white mb-2 border-b border-white/10 pb-1" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-sm font-bold text-white mb-1.5" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-semibold text-primary mb-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="self-start bg-surface-container border border-white/5 p-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="p-3 bg-surface-dim border-t border-white/5">
            <form onSubmit={handleSend} className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a question..." 
                className="flex-1 bg-surface-container rounded-full px-4 py-2 text-sm text-on-surface border border-white/10 focus:outline-none focus:border-primary transition-colors"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined" style={{fontSize: '20px'}}>send</span>
              </button>
            </form>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        title="Open AI Chatbot"
      >
        <span className="material-symbols-outlined" style={{fontSize: '28px'}}>{isOpen ? 'close' : 'chat'}</span>
      </button>
    </div>
  )
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

  // History State with localStorage persistence
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('aegis_ai_history_v1')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load history', e)
    }
    return []
  })
  const [currentScanId, setCurrentScanId] = useState(null)
  const [historySearch, setHistorySearch] = useState('')
  const [historyLangFilter, setHistoryLangFilter] = useState('All')
  const [historyRiskFilter, setHistoryRiskFilter] = useState('All')
  const [historySort, setHistorySort] = useState('newest')
  const [copiedHistoryId, setCopiedHistoryId] = useState(null)
  const [copiedCodeId, setCopiedCodeId] = useState(null)

  // Light / Dark Theme State with persistence
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('app_theme')
      if (saved) return saved
    } catch (e) {}
    return 'dark'
  })
  const [showThemeHint, setShowThemeHint] = useState(true)

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
    try {
      localStorage.setItem('app_theme', theme)
    } catch (e) {}
  }, [theme])

  // Intimation hint auto-dismiss after 4.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowThemeHint(false)
    }, 4500)
    return () => clearTimeout(timer)
  }, [])

  const toggleTheme = (selectedTheme) => {
    setTheme(selectedTheme)
    setShowThemeHint(false)
  }

  const [result, setResult] = useState(null)
  const [filter, setFilter] = useState('All')
  const [selectedError, setSelectedError] = useState(null)
  const [prReport, setPrReport] = useState(null)
  const [prLoading, setPrLoading] = useState(false)

  const [fixState, setFixState] = useState({})
  const [fixedCode, setFixedCode] = useState(null)
  const [isFixingAll, setIsFixingAll] = useState(false)
  const [showFixedCode, setShowFixedCode] = useState(false)
  const [copiedFixed, setCopiedFixed] = useState(false)

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
    setSelectedError(null)
    setPrReport(null)
    setFixedCode(null)
    setShowFixedCode(false)

    try {
      let res
      let fileText = ''
      if (mode === 'file') {
        fileText = await file.text()
        res = await api.analyzeFile(file)
        res.submission = res.submission || {}
        res.submission.filename = file.name
      } else {
        const detectedLang = detectLanguage(code)
        res = await api.analyzeText(code, detectedLang)
      }

      const submittedCode = mode === 'file' ? fileText : code
      const submittedLang = res.submission?.language || detectLanguage(submittedCode)
      const filename = mode === 'file' ? file.name : ''
      res._submittedCode = submittedCode
      res._submittedLanguage = submittedLang
      res._filename = filename

      const score = res.summary?.code_health_score ?? calculateHealthScore(res.summary?.severity_breakdown)
      const codeTitle = generateCodeTitle(submittedCode, submittedLang, filename)
      const newScanId = 'scan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)

      const newHistoryItem = {
        id: newScanId,
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        title: codeTitle,
        filename: filename || '',
        language: submittedLang,
        code: submittedCode,
        healthScore: score,
        summary: res.summary || {},
        findings: res.findings || [],
        prReport: null,
        fixedCode: null,
      }

      setHistory(prev => {
        const updated = [newHistoryItem, ...prev.filter(item => item.id !== newScanId)]
        try {
          localStorage.setItem('aegis_ai_history_v1', JSON.stringify(updated.slice(0, 100)))
        } catch (e) {
          console.error('Failed to persist history', e)
        }
        return updated
      })
      setCurrentScanId(newScanId)

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
          result._filename || result.submission?.filename || 'uploaded_code',
          result._submittedLanguage || result.submission?.language || 'python'
        )
        setPrReport(data)

        // Update history item with prReport and health score
        if (currentScanId) {
          setHistory(prev => {
            const updated = prev.map(item => {
              if (item.id === currentScanId) {
                return {
                  ...item,
                  prReport: data,
                  healthScore: data.code_health_score ?? item.healthScore
                }
              }
              return item
            })
            try {
              localStorage.setItem('aegis_ai_history_v1', JSON.stringify(updated))
            } catch (e) {}
            return updated
          })
        }
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
        if (currentScanId) {
          setHistory(prev => {
            const updated = prev.map(item => {
              if (item.id === currentScanId) {
                return { ...item, fixedCode: res.fixed_code }
              }
              return item
            })
            try {
              localStorage.setItem('aegis_ai_history_v1', JSON.stringify(updated))
            } catch (e) {}
            return updated
          })
        }
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

  // History item actions
  const viewHistoricalScan = (hItem) => {
    const reconstructedResult = {
      submission: {
        language: hItem.language,
        lines: (hItem.code || '').split('\n').length,
        source: hItem.filename ? 'file' : 'paste',
        filename: hItem.filename || hItem.title
      },
      execution_time_seconds: 3.5,
      summary: hItem.summary || {},
      findings: hItem.findings || [],
      _submittedCode: hItem.code || '',
      _submittedLanguage: hItem.language || 'python',
      _filename: hItem.filename || ''
    }
    setResult(reconstructedResult)
    setCode(hItem.code || '')
    setPrReport(hItem.prReport || null)
    setFixedCode(hItem.fixedCode || null)
    setShowFixedCode(!!hItem.fixedCode)
    setCurrentScanId(hItem.id)
    setActiveTab('results')
  }

  const copyHistoryReport = (hItem) => {
    const markdown = generateMarkdownReport(hItem)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(markdown).then(() => {
        setCopiedHistoryId(hItem.id)
        setTimeout(() => setCopiedHistoryId(null), 2500)
      })
    } else {
      const ta = document.createElement('textarea')
      ta.value = markdown
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedHistoryId(hItem.id)
      setTimeout(() => setCopiedHistoryId(null), 2500)
    }
  }

  const copyHistoryCode = (hItem) => {
    if (!hItem.code) return
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(hItem.code).then(() => {
        setCopiedCodeId(hItem.id)
        setTimeout(() => setCopiedCodeId(null), 2000)
      })
    }
  }

  const downloadHistoryJSON = (hItem) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(hItem, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `aegis-ai-${(hItem.title || 'scan').replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const deleteHistoryItem = (id, e) => {
    if (e) e.stopPropagation()
    if (window.confirm("Are you sure you want to remove this scan from history?")) {
      setHistory(prev => {
        const updated = prev.filter(item => item.id !== id)
        try {
          localStorage.setItem('aegis_ai_history_v1', JSON.stringify(updated))
        } catch (err) {}
        return updated
      })
    }
  }

  const clearAllHistory = () => {
    if (window.confirm("Are you sure you want to clear all analysis history? This action cannot be undone.")) {
      setHistory([])
      try {
        localStorage.removeItem('aegis_ai_history_v1')
      } catch (e) {}
    }
  }

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Search term
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase()
        const titleMatch = (item.title || '').toLowerCase().includes(query)
        const langMatch = (item.language || '').toLowerCase().includes(query)
        const codeMatch = (item.code || '').toLowerCase().includes(query)
        const findingsMatch = (item.findings || []).some(f => 
          (f.type || '').toLowerCase().includes(query) || 
          (f.description || '').toLowerCase().includes(query)
        )
        if (!titleMatch && !langMatch && !codeMatch && !findingsMatch) return false
      }
      // Language filter
      if (historyLangFilter !== 'All') {
        const itemLang = (item.language || '').toLowerCase()
        if (itemLang !== historyLangFilter.toLowerCase()) return false
      }
      // Risk filter
      if (historyRiskFilter !== 'All') {
        const itemRisk = item.summary?.risk_level || 'Low'
        if (itemRisk.toLowerCase() !== historyRiskFilter.toLowerCase()) return false
      }
      return true
    }).sort((a, b) => {
      if (historySort === 'newest') return new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      if (historySort === 'oldest') return new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
      if (historySort === 'score_low') return (a.healthScore ?? 100) - (b.healthScore ?? 100)
      if (historySort === 'score_high') return (b.healthScore ?? 100) - (a.healthScore ?? 100)
      if (historySort === 'defects') return (b.findings?.length || 0) - (a.findings?.length || 0)
      return 0
    })
  }, [history, historySearch, historyLangFilter, historyRiskFilter, historySort])

  const historyStats = useMemo(() => {
    const totalScans = history.length
    if (totalScans === 0) return { totalScans: 0, avgHealth: 0, totalCritical: 0, totalDefects: 0 }
    const totalHealth = history.reduce((sum, item) => sum + (item.healthScore ?? 100), 0)
    const avgHealth = Math.round(totalHealth / totalScans)
    const totalCritical = history.reduce((sum, item) => sum + (item.summary?.severity_breakdown?.Critical || 0), 0)
    const totalDefects = history.reduce((sum, item) => sum + (item.findings?.length || 0), 0)
    return { totalScans, avgHealth, totalCritical, totalDefects }
  }, [history])

  const availableLanguages = useMemo(() => {
    const set = new Set(history.map(item => item.language).filter(Boolean))
    return ['All', ...Array.from(set)]
  }, [history])

  const canRun = mode === 'paste' ? code.trim().length > 0 : !!file

  const findings = result?.findings || []
  const summary = result?.summary || {}
  const breakdown = summary.severity_breakdown || {}
  const healthScore = prReport?.code_health_score ?? (result?.summary?.code_health_score ?? calculateHealthScore(breakdown))
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

  // Severity Distribution Chart Data
  const chartData = [
    { name: 'Critical', value: breakdown.Critical || 0, fill: '#ef4444' },
    { name: 'High', value: breakdown.High || 0, fill: '#f97316' },
    { name: 'Medium', value: breakdown.Medium || 0, fill: '#eab308' },
    { name: 'Low', value: breakdown.Low || 0, fill: '#3b82f6' }
  ].filter(d => d.value > 0)

  // Error Types & Cause Impact Dataset Calculation
  const ERROR_PALETTE = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Amber
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#f43f5e', // Rose
    '#a855f7'  // Purple
  ]

  const SEVERITY_WEIGHT = {
    Critical: 40,
    High: 25,
    Medium: 15,
    Low: 5
  }

  const SHORT_NAME_MAP = {
    'Hardcoded Secret': 'Secrets',
    'Hardcoded Credentials': 'Credentials',
    'Too Many Parameters': 'Too Many Params',
    'Bare Except': 'Bare Except',
    'Command Injection': 'Cmd Injection',
    'SQL Injection': 'SQL Injection',
    'Cross-Site Scripting': 'XSS Defect',
    'Insecure Deserialization': 'Deserialization',
    'Session Disabled': 'Session Config',
    'Dangerous Eval': 'Dangerous Eval',
    'Path Traversal': 'Path Traversal'
  }

  const errorTypesData = useMemo(() => {
    if (!findings || findings.length === 0) return []

    const typeMap = {}
    findings.forEach(f => {
      const rawType = f.type || f.finding_type || f.title || 'Security Defect'
      // Strip parenthetical items e.g. (OWASP A07:2021) or (Error Handling) for clean X-axis display
      const baseName = rawType.replace(/\s*\([^)]*\)/g, '').replace(/_/g, ' ').trim()
      const shortName = SHORT_NAME_MAP[baseName] || (baseName.length > 16 ? baseName.slice(0, 14) + '…' : baseName)
      const fullName = rawType.replace(/_/g, ' ').trim()
      
      if (!typeMap[shortName]) {
        typeMap[shortName] = {
          name: shortName, // Short concise name for bottom of the bar
          fullName: fullName, // Full name with OWASP/classification
          count: 0,
          severities: [],
          highestSev: f.severity || 'Medium',
          totalImpactScore: 0,
          description: f.description || '',
          recommendation: f.recommendation || f.fix_summary || f.action_required || '',
          lines: []
        }
      }
      typeMap[shortName].count += 1
      typeMap[shortName].severities.push(f.severity || 'Medium')
      if (f.line || f.line_number) {
        typeMap[shortName].lines.push(f.line || f.line_number)
      }
      const weight = SEVERITY_WEIGHT[f.severity] || 15
      typeMap[shortName].totalImpactScore += weight
    })

    const totalImpact = Object.values(typeMap).reduce((sum, item) => sum + item.totalImpactScore, 0) || 1

    return Object.values(typeMap).map((item, index) => {
      const percentage = Math.max(1, Math.round((item.totalImpactScore / totalImpact) * 100))
      return {
        ...item,
        value: item.count,
        impactScore: item.totalImpactScore,
        causePercentage: percentage,
        fill: ERROR_PALETTE[index % ERROR_PALETTE.length]
      }
    }).sort((a, b) => b.impactScore - a.impactScore)
  }, [findings])

  return (
    <>
      <header className="bg-white/95 dark:bg-surface/80 backdrop-blur-xl fixed top-0 w-full z-50 border-b border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_20px_40px_rgba(99,102,241,0.15)] flex justify-between items-center px-4 md:px-margin-desktop max-w-container-max mx-auto h-20 left-0 right-0">
        <div className="flex items-center gap-gutter">
          <a className="font-headline-md text-headline-md font-black tracking-tighter text-indigo-700 dark:text-primary flex items-center gap-2" href="#">
            <span className="material-symbols-outlined" style={{fontSize: '28px', fontVariationSettings: "'FILL' 1"}}>policy</span>
            <span className="hidden sm:inline">Aegis AI</span>
          </a>
          <nav className="flex items-center gap-2 md:gap-stack-lg ml-2 md:ml-stack-lg">
            <button onClick={() => setActiveTab('scanner')} className={`${activeTab === 'scanner' ? 'text-indigo-700 dark:text-primary border-b-2 border-indigo-600 dark:border-primary pb-1 font-bold' : 'text-slate-700 dark:text-on-surface-variant hover:text-slate-950 dark:hover:text-on-surface hover:bg-indigo-50 dark:hover:bg-primary/10 font-medium'} px-2.5 md:px-3 py-1.5 md:py-2 rounded-md active:scale-95 transition-all duration-300 text-sm md:text-base`}>Scanner</button>
            <button onClick={() => setActiveTab('results')} disabled={!result} className={`${activeTab === 'results' ? 'text-indigo-700 dark:text-primary border-b-2 border-indigo-600 dark:border-primary pb-1 font-bold' : 'text-slate-700 dark:text-on-surface-variant'} ${!result ? 'opacity-50 cursor-not-allowed' : 'hover:text-slate-950 dark:hover:text-on-surface hover:bg-indigo-50 dark:hover:bg-primary/10 font-medium'} px-2.5 md:px-3 py-1.5 md:py-2 rounded-md active:scale-95 transition-all duration-300 text-sm md:text-base`}>Results</button>
            <button onClick={() => setActiveTab('history')} className={`${activeTab === 'history' ? 'text-indigo-700 dark:text-primary border-b-2 border-indigo-600 dark:border-primary pb-1 font-bold' : 'text-slate-700 dark:text-on-surface-variant hover:text-slate-950 dark:hover:text-on-surface hover:bg-indigo-50 dark:hover:bg-primary/10 font-medium'} px-2.5 md:px-3 py-1.5 md:py-2 rounded-md active:scale-95 transition-all duration-300 text-sm md:text-base flex items-center gap-1.5`}>
              <span>History</span>
              {history.length > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.2 bg-indigo-100 dark:bg-primary/20 text-indigo-700 dark:text-primary rounded-full">
                  {history.length}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('agents')} className={`${activeTab === 'agents' ? 'text-indigo-700 dark:text-primary border-b-2 border-indigo-600 dark:border-primary pb-1 font-bold' : 'text-slate-700 dark:text-on-surface-variant hover:text-slate-950 dark:hover:text-on-surface hover:bg-indigo-50 dark:hover:bg-primary/10 font-medium'} px-2.5 md:px-3 py-1.5 md:py-2 rounded-md active:scale-95 transition-all duration-300 text-sm md:text-base`}>Agents Pipeline</button>
          </nav>
        </div>

        {/* Modes Switching Container with Entrance Intimation */}
        <div className="relative flex items-center">
          <div className="flex items-center bg-slate-200/90 dark:bg-surface-variant/80 border border-slate-300 dark:border-white/10 rounded-xl p-1 shadow-inner dark:shadow-sm backdrop-blur-md">
            <button
              onClick={() => toggleTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                theme === 'light'
                  ? 'bg-white text-indigo-950 shadow-md ring-1 ring-black/5'
                  : 'text-slate-600 dark:text-outline-variant hover:text-slate-900 dark:hover:text-on-surface'
              }`}
              title="Switch to Light Mode"
            >
              <span className="material-symbols-outlined text-amber-500" style={{ fontSize: '16px', fontVariationSettings: theme === 'light' ? "'FILL' 1" : "'FILL' 0" }}>light_mode</span>
              <span className="hidden sm:inline">Light</span>
            </button>

            <button
              onClick={() => toggleTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                theme === 'dark'
                  ? 'bg-indigo-600 dark:bg-primary text-white dark:text-on-primary shadow-md'
                  : 'text-slate-600 dark:text-outline-variant hover:text-slate-900 dark:hover:text-on-surface'
              }`}
              title="Switch to Dark Mode"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: theme === 'dark' ? "'FILL' 1" : "'FILL' 0" }}>dark_mode</span>
              <span className="hidden sm:inline">Dark</span>
            </button>
          </div>

          {/* Entrance Intimation Tooltip */}
          {showThemeHint && (
            <div className="absolute top-full right-0 mt-3 z-50 animate-tooltip-in pointer-events-auto">
              <div className="animate-tooltip-float relative bg-gradient-to-r from-indigo-600 via-indigo-700 to-primary text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 border border-white/20 whitespace-nowrap">
                <span className="material-symbols-outlined text-amber-300 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
                <span>You can switch between Light and Dark mode here!</span>
                <button
                  onClick={() => setShowThemeHint(false)}
                  className="hover:opacity-75 text-white/80 p-0.5 ml-1 rounded-full transition-opacity"
                  title="Dismiss hint"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
                {/* Top arrow pointer pointing to switch button */}
                <div className="w-2.5 h-2.5 bg-indigo-600 rotate-45 absolute -top-1 right-8 border-l border-t border-white/20"></div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 pt-20">
        <aside className="bg-white/95 dark:bg-surface-container-low/80 backdrop-blur-lg border-r border-slate-200 dark:border-white/5 h-[calc(100vh-80px)] w-64 fixed left-0 top-20 z-40 flex flex-col py-stack-lg px-stack-md hidden md:flex shadow-sm dark:shadow-none">
          <div className="mb-stack-lg px-4">
            <div className="flex items-center gap-3 mb-2">
              <div>
                <h2 className="font-label-caps text-label-caps uppercase tracking-widest text-slate-800 dark:text-on-background font-bold">Multi-Agent Engine</h2>
                <p className={`text-xs ${analyzing ? 'text-indigo-600 dark:text-primary animate-pulse font-semibold' : 'text-emerald-600 dark:text-emerald-500 font-medium'}`}>{analyzing ? 'Active Scanning...' : 'System Ready'}</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 flex flex-col gap-2">
            <button onClick={() => setActiveTab('scanner')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ${activeTab === 'scanner' ? 'bg-indigo-100/90 dark:bg-primary-container text-indigo-900 dark:text-on-primary-container font-bold border border-indigo-200/80 dark:border-transparent shadow-sm' : 'text-slate-600 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-variant hover:text-slate-900 font-medium'}`}>
              <span className="material-symbols-outlined">search</span>
              <span className="font-body-md text-body-md">Scanner Engine</span>
            </button>
            <button onClick={() => { if(result) setActiveTab('results') }} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ${activeTab === 'results' ? 'bg-indigo-100/90 dark:bg-primary-container text-indigo-900 dark:text-on-primary-container font-bold border border-indigo-200/80 dark:border-transparent shadow-sm' : 'text-slate-600 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-variant hover:text-slate-900 font-medium'} ${!result ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>security</span>
              <span className="font-body-md text-body-md">Vulnerabilities</span>
            </button>
            <button onClick={() => setActiveTab('history')} className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ${activeTab === 'history' ? 'bg-indigo-100/90 dark:bg-primary-container text-indigo-900 dark:text-on-primary-container font-bold border border-indigo-200/80 dark:border-transparent shadow-sm' : 'text-slate-600 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-variant hover:text-slate-900 font-medium'}`}>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined">history</span>
                <span className="font-body-md text-body-md">History & Reports</span>
              </div>
              {history.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-200/70 dark:bg-primary/20 text-indigo-900 dark:text-primary">
                  {history.length}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('agents')} className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out ${activeTab === 'agents' ? 'bg-indigo-100/90 dark:bg-primary-container text-indigo-900 dark:text-on-primary-container font-bold border border-indigo-200/80 dark:border-transparent shadow-sm' : 'text-slate-600 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-variant hover:text-slate-900 font-medium'}`}>
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
                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                       <span className={`w-2 h-2 rounded-full ${analyzing ? 'bg-primary animate-pulse' : 'bg-emerald-500'}`}></span>
                       <span className="text-xs text-outline-variant font-mono">{analyzing ? 'Analyzing AST...' : 'Status: Standby'}</span>
                    </div>
                  </div>

                  {/* Security Vulnerability Agent */}
                  <div className="glass-panel rounded-xl p-6 border-t-2 border-risk-critical relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-risk-critical">Security Agent</h3>
                      <span className="material-symbols-outlined text-risk-critical" style={{fontVariationSettings: "'FILL' 1"}}>security</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4">Cross-references OWASP Top 10 to detect injection vulnerabilities and hardcoded secrets.</p>
                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                       <span className={`w-2 h-2 rounded-full ${analyzing ? 'bg-risk-critical animate-pulse' : 'bg-emerald-500'}`}></span>
                       <span className="text-xs text-outline-variant font-mono">{analyzing ? 'Scanning signatures...' : 'Status: Standby'}</span>
                    </div>
                  </div>

                  {/* Remediation Agent */}
                  <div className="glass-panel rounded-xl p-6 border-t-2 border-emerald-500 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-emerald-500">Remediation Agent</h3>
                      <span className="material-symbols-outlined text-emerald-500" style={{fontVariationSettings: "'FILL' 1"}}>healing</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4">Generates context-aware, completely secure code replacements for detected vulnerabilities.</p>
                    <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                       <span className={`w-2 h-2 rounded-full ${isFixingAll ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                       <span className="text-xs text-outline-variant font-mono">{isFixingAll ? 'Generating fixes...' : 'Status: Standby'}</span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Work Pipeline Metrics */}
                <div className="mt-12">
                  <h2 className="font-headline-md text-xl mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">timeline</span>
                    Active Job Pipeline
                  </h2>
                  
                  <div className="glass-panel rounded-2xl p-6 border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="relative z-10 flex flex-col gap-6">
                      
                      {/* Step 1: Code Reception */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${result ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-white/10 text-outline-variant'}`}>
                            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>code</span>
                          </div>
                          <div className={`w-1 h-16 ${result ? 'bg-primary/50' : 'bg-white/10'}`}></div>
                        </div>
                        <div className="flex-1 mt-1">
                          <h4 className={`font-bold ${result ? 'text-white' : 'text-outline-variant'}`}>1. Code Submission</h4>
                          {result ? (
                            <p className="text-sm text-on-surface-variant mt-1">
                              Successfully parsed <strong className="text-primary">{result.submission?.lines || 0}</strong> lines of <strong className="text-primary">{result.submission?.language || 'code'}</strong>.
                            </p>
                          ) : (
                            <p className="text-sm text-outline-variant mt-1">Awaiting code input...</p>
                          )}
                        </div>
                      </div>

                      {/* Step 2: Analysis */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${analyzing ? 'bg-risk-critical/20 border-risk-critical text-risk-critical animate-pulse' : result ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-white/10 text-outline-variant'}`}>
                            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>search</span>
                          </div>
                          <div className={`w-1 h-16 ${result ? 'bg-primary/50' : 'bg-white/10'}`}></div>
                        </div>
                        <div className="flex-1 mt-1">
                          <h4 className={`font-bold ${analyzing ? 'text-risk-critical' : result ? 'text-white' : 'text-outline-variant'}`}>2. Multi-Agent Vulnerability Scan</h4>
                          {analyzing ? (
                            <p className="text-sm text-risk-critical mt-1 animate-pulse">Running static analysis and LLM inspection...</p>
                          ) : result ? (
                            <div className="mt-2 grid grid-cols-4 gap-2 max-w-sm">
                              <div className="bg-surface-dim p-2 rounded border border-white/5 text-center">
                                <div className="text-xs text-outline-variant">Critical</div>
                                <div className="font-bold text-risk-critical">{result.summary?.severity_breakdown?.Critical || 0}</div>
                              </div>
                              <div className="bg-surface-dim p-2 rounded border border-white/5 text-center">
                                <div className="text-xs text-outline-variant">High</div>
                                <div className="font-bold text-risk-high">{result.summary?.severity_breakdown?.High || 0}</div>
                              </div>
                              <div className="bg-surface-dim p-2 rounded border border-white/5 text-center">
                                <div className="text-xs text-outline-variant">Medium</div>
                                <div className="font-bold text-risk-medium">{result.summary?.severity_breakdown?.Medium || 0}</div>
                              </div>
                              <div className="bg-surface-dim p-2 rounded border border-white/5 text-center">
                                <div className="text-xs text-outline-variant">Low</div>
                                <div className="font-bold text-risk-low">{result.summary?.severity_breakdown?.Low || 0}</div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-outline-variant mt-1">Waiting for code to analyze.</p>
                          )}
                        </div>
                      </div>

                      {/* Step 3: PR Summary */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${prLoading ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500 animate-pulse' : prReport ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-white/10 text-outline-variant'}`}>
                            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>summarize</span>
                          </div>
                          <div className={`w-1 h-16 ${prReport ? 'bg-primary/50' : 'bg-white/10'}`}></div>
                        </div>
                        <div className="flex-1 mt-1">
                          <h4 className={`font-bold ${prLoading ? 'text-emerald-500' : prReport ? 'text-white' : 'text-outline-variant'}`}>3. PR Context Generation</h4>
                          {prLoading ? (
                            <p className="text-sm text-emerald-500 mt-1 animate-pulse">Generating executive summary...</p>
                          ) : prReport ? (
                            <p className="text-sm text-on-surface-variant mt-1">
                              Summary generated with code health score: <strong className="text-primary">{prReport.code_health_score || 0}/100</strong>.
                            </p>
                          ) : (
                            <p className="text-sm text-outline-variant mt-1">Waiting for analysis results.</p>
                          )}
                        </div>
                      </div>

                      {/* Step 4: Remediation */}
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isFixingAll ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500 animate-pulse' : fixedCode ? 'bg-emerald-500 border-emerald-500 text-on-primary' : 'bg-surface border-white/10 text-outline-variant'}`}>
                            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>build</span>
                          </div>
                        </div>
                        <div className="flex-1 mt-1">
                          <h4 className={`font-bold ${isFixingAll ? 'text-emerald-500' : fixedCode ? 'text-emerald-500' : 'text-outline-variant'}`}>4. Automated Remediation</h4>
                          {isFixingAll ? (
                            <p className="text-sm text-emerald-500 mt-1 animate-pulse">Generating fixed codebase...</p>
                          ) : fixedCode ? (
                            <p className="text-sm text-emerald-500 mt-1">All vulnerabilities resolved. Secure code generated.</p>
                          ) : (
                            <p className="text-sm text-outline-variant mt-1">Awaiting user trigger for global fix.</p>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Live System Log Simulator */}
                <div className="mt-12 mb-8">
                  <h2 className="font-headline-md text-xl mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline-variant">terminal</span>
                    Live Execution Logs
                  </h2>
                  <div className="bg-[#0d0d12] rounded-xl border border-white/10 p-4 font-mono text-xs overflow-hidden relative shadow-inner">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-emerald-500 to-risk-critical opacity-50"></div>
                    <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                      <div className="w-3 h-3 rounded-full bg-error"></div>
                      <div className="w-3 h-3 rounded-full bg-risk-medium"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="space-y-2 text-gray-400 h-48 overflow-y-auto" style={{ textShadow: '0 0 5px rgba(255,255,255,0.1)' }}>
                      {analyzing ? (
                        <>
                          <div className="text-emerald-400"><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [SYS] Initialize Multi-Agent Pipeline...</div>
                          <div><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [AST] Parsing source code tree... OK</div>
                          <div><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [SEC] Loading OWASP rule definitions...</div>
                          <div className="text-primary"><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [GEMINI] Routing request via Universal API...</div>
                          <div className="animate-pulse">_ Waiting for agent consensus...</div>
                        </>
                      ) : isFixingAll ? (
                        <>
                          <div><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [REM] Compiling vulnerability list...</div>
                          <div className="text-emerald-400"><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [REM] Generating secure code replacements...</div>
                          <div className="text-primary"><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [GEMINI] Hitting raw REST endpoint with context...</div>
                          <div className="animate-pulse">_ Applying diff...</div>
                        </>
                      ) : (
                        <>
                          <div><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [SYS] System Ready. All agents idle.</div>
                          <div><span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> [ROUTER] Universal API connections healthy.</div>
                          <div className="text-emerald-400 opacity-70">_</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scanner' && (
            <div>
              <div className="mb-section-gap">
                <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg mb-2">Aegis AI</h1>
                <p className="text-on-surface-variant">Submit your code for multi-agent security analysis, vulnerability detection, and automated remediation.</p>
              </div>

              {/* Scanner Input Area */}
              <div className="mb-section-gap glass-panel rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <div className="bg-slate-50 dark:bg-surface-container-low px-4 py-3 flex justify-between items-center border-b border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600 dark:text-outline-variant text-sm">code</span>
                    <span className="font-code-sm text-code-sm text-slate-800 dark:text-on-surface-variant font-bold">Input Code</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handlePaste} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs md:text-sm font-semibold transition-all ${mode === 'paste' ? 'bg-indigo-600 dark:bg-primary text-white dark:text-on-primary shadow-sm' : 'bg-white dark:bg-transparent text-slate-700 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-variant border border-slate-200 dark:border-transparent'}`}><span className="material-symbols-outlined" style={{fontSize: '16px'}}>content_paste</span> Paste</button>
                    <button onClick={() => setMode('file')} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs md:text-sm font-semibold transition-all ${mode === 'file' ? 'bg-indigo-600 dark:bg-primary text-white dark:text-on-primary shadow-sm' : 'bg-white dark:bg-transparent text-slate-700 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-variant border border-slate-200 dark:border-transparent'}`}><span className="material-symbols-outlined" style={{fontSize: '16px'}}>upload</span> Upload</button>
                    {mode === 'paste' && <button onClick={loadSample} className="px-3 py-1.5 rounded text-xs md:text-sm font-semibold bg-white dark:bg-transparent text-slate-700 dark:text-on-surface-variant hover:bg-slate-100 dark:hover:bg-surface-variant border border-slate-200 dark:border-transparent">Sample</button>}
                  </div>
                </div>
                
                {mode === 'paste' ? (
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    language={detectLanguage(code)}
                    placeholder="// Click 'Paste' to import from clipboard, or type your source code here..."
                  />
                ) : (
                  <div 
                    className={`min-h-[400px] flex items-center justify-center flex-col m-4 rounded border-2 border-dashed cursor-pointer transition-colors ${dragOver ? 'border-indigo-600 dark:border-primary bg-indigo-50 dark:bg-primary/5' : 'border-slate-300 dark:border-white/10 hover:border-indigo-400 dark:hover:border-white/30'}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }} />
                    {file ? (
                      <>
                        <span className="material-symbols-outlined text-4xl mb-2 text-indigo-600 dark:text-primary">description</span>
                        <div className="font-semibold text-slate-800 dark:text-on-surface">{file.name}</div>
                        <button onClick={e => { e.stopPropagation(); setFile(null); setMode('paste') }} className="mt-4 px-4 py-2 bg-error/20 text-error rounded hover:bg-error/30 transition-colors font-semibold">Remove File</button>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-4xl mb-2 text-slate-400 dark:text-outline-variant">upload_file</span>
                        <div className="font-semibold text-slate-700 dark:text-on-surface">Drop your source file here</div>
                        <div className="text-sm text-slate-500 dark:text-outline-variant">or click to browse</div>
                      </>
                    )}
                  </div>
                )}

                <div className="p-4 flex justify-end border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-surface-container-low">
                  <button 
                    onClick={runAnalysis} 
                    disabled={loading || !canRun} 
                    className="bg-indigo-600 dark:bg-primary text-white dark:text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center gap-2 hover:bg-indigo-700 dark:hover:brightness-110 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {loading ? <span className="spin"></span> : <span className="material-symbols-outlined text-lg" style={{fontVariationSettings: "'FILL' 1"}}>play_arrow</span>}
                    {loading ? 'Analyzing...' : 'Run Analysis'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="mb-section-gap flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg mb-2 text-slate-900 dark:text-on-surface font-black">Analysis History & Reports</h1>
                  <p className="text-slate-600 dark:text-on-surface-variant font-medium">Review previous multi-agent security scans, inspect results, or copy and download audit reports.</p>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={clearAllHistory}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold text-red-600 dark:text-rose-400 bg-red-50 dark:bg-rose-500/10 hover:bg-red-100 dark:hover:bg-rose-500/20 border border-red-200 dark:border-rose-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete_sweep</span>
                    Clear All History
                  </button>
                )}
              </div>

              {/* Metrics / Stats Banner */}
              {history.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-outline-variant font-bold uppercase tracking-wider">Total Scans</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-on-surface mt-1">{historyStats.totalScans}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined">history</span>
                    </div>
                  </div>

                  <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-outline-variant font-bold uppercase tracking-wider">Avg Code Health</div>
                      <div className={`text-2xl font-black mt-1 ${historyStats.avgHealth < 50 ? 'text-red-600 dark:text-error' : historyStats.avgHealth < 80 ? 'text-amber-600 dark:text-risk-medium' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {historyStats.avgHealth}<span className="text-xs text-slate-500 dark:text-outline-variant">/100</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <span className="material-symbols-outlined">health_metrics</span>
                    </div>
                  </div>

                  <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-outline-variant font-bold uppercase tracking-wider">Critical Blockers</div>
                      <div className="text-2xl font-black text-red-600 dark:text-risk-critical mt-1">{historyStats.totalCritical}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-risk-critical flex items-center justify-center">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>gpp_bad</span>
                    </div>
                  </div>

                  <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-outline-variant font-bold uppercase tracking-wider">Total Defects</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-on-surface mt-1">{historyStats.totalDefects}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <span className="material-symbols-outlined">bug_report</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Search & Filter Controls */}
              {history.length > 0 && (
                <div className="glass-panel p-4 rounded-xl border border-slate-200 dark:border-white/10 mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  {/* Search */}
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 dark:text-outline-variant text-lg">search</span>
                    <input
                      type="text"
                      placeholder="Search history by code title, language, or findings..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs md:text-sm rounded-lg bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-slate-900 dark:text-on-surface placeholder-slate-400 dark:placeholder-outline-variant focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-primary"
                    />
                    {historySearch && (
                      <button onClick={() => setHistorySearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs">
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                      </button>
                    )}
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Language filter */}
                    <select
                      value={historyLangFilter}
                      onChange={(e) => setHistoryLangFilter(e.target.value)}
                      className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-slate-700 dark:text-on-surface focus:outline-none"
                    >
                      <option value="All">All Languages</option>
                      {availableLanguages.filter(l => l !== 'All').map(lang => (
                        <option key={lang} value={lang}>{formatLanguageDisplay(lang)}</option>
                      ))}
                    </select>

                    {/* Risk Level Filter */}
                    <select
                      value={historyRiskFilter}
                      onChange={(e) => setHistoryRiskFilter(e.target.value)}
                      className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-slate-700 dark:text-on-surface focus:outline-none"
                    >
                      <option value="All">All Risk Levels</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>

                    {/* Sort */}
                    <select
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value)}
                      className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-slate-700 dark:text-on-surface focus:outline-none"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="score_low">Lowest Health Score</option>
                      <option value="score_high">Highest Health Score</option>
                      <option value="defects">Most Defects</option>
                    </select>
                  </div>
                </div>
              )}

              {/* History List or Empty State */}
              {filteredHistory.length === 0 ? (
                <div className="glass-panel rounded-2xl p-12 text-center border border-slate-200 dark:border-white/10 shadow-sm flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-primary/10 text-indigo-600 dark:text-primary flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>history_toggle_off</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-on-surface mb-1">
                    {history.length === 0 ? 'No Analysis History Yet' : 'No Matching Analyses Found'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-on-surface-variant max-w-md mb-6">
                    {history.length === 0 
                      ? 'When you run security and health analyses in the Scanner Engine, your past scans and generated reports will automatically be recorded here.' 
                      : 'Try adjusting your search query or filter settings.'}
                  </p>
                  {history.length === 0 ? (
                    <button
                      onClick={() => setActiveTab('scanner')}
                      className="bg-indigo-600 dark:bg-primary text-white dark:text-on-primary font-bold px-6 py-2.5 rounded-xl text-sm shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
                      Start a Code Scan
                    </button>
                  ) : (
                    <button
                      onClick={() => { setHistorySearch(''); setHistoryLangFilter('All'); setHistoryRiskFilter('All'); }}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-indigo-600 dark:text-primary bg-indigo-50 dark:bg-primary/10 hover:bg-indigo-100 transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredHistory.map((item) => {
                    const itemHealth = item.healthScore ?? calculateHealthScore(item.summary?.severity_breakdown)
                    const sev = item.summary?.severity_breakdown || {}
                    const isCopied = copiedHistoryId === item.id
                    const isCodeCopied = copiedCodeId === item.id

                    return (
                      <div
                        key={item.id}
                        className="glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-primary/40 transition-all duration-200 shadow-sm hover:shadow-md bg-white dark:bg-surface/80 flex flex-col justify-between group"
                      >
                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                          {/* Left: Title, Tag, Timestamp */}
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-surface-variant text-indigo-600 dark:text-primary mt-0.5">
                              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                                {item.filename ? 'description' : 'code_blocks'}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center flex-wrap gap-2 mb-1">
                                <h3 className="font-bold text-base text-slate-900 dark:text-on-surface group-hover:text-indigo-600 dark:group-hover:text-primary transition-colors">
                                  {item.title}
                                </h3>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-surface-variant text-slate-700 dark:text-on-surface-variant border border-slate-200 dark:border-white/5">
                                  {formatLanguageDisplay(item.language)}
                                </span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                  item.summary?.risk_level === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-risk-critical/20 dark:text-risk-critical' :
                                  item.summary?.risk_level === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-risk-high/20 dark:text-risk-high' :
                                  item.summary?.risk_level === 'Medium' ? 'bg-amber-100 text-amber-800 dark:bg-risk-medium/20 dark:text-risk-medium' :
                                  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-500'
                                }`}>
                                  {item.summary?.risk_level || 'Low'} Risk
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-outline-variant font-medium">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>
                                  {item.formattedTime || new Date(item.timestamp).toLocaleString()}
                                </span>
                                {item.filename && (
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>folder_open</span>
                                    {item.filename}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Health Score mini badge & defect counts */}
                          <div className="flex items-center gap-4 self-start lg:self-center">
                            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/5">
                              <div className="text-right">
                                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-outline-variant tracking-wider">Health Score</div>
                                <div className={`text-lg font-black ${itemHealth < 50 ? 'text-red-600 dark:text-error' : itemHealth < 80 ? 'text-amber-600 dark:text-risk-medium' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {itemHealth}<span className="text-xs text-slate-400 dark:text-outline-variant">/100</span>
                                </div>
                              </div>
                              <div className={`w-3 h-3 rounded-full ${itemHealth < 50 ? 'bg-red-500 shadow-sm shadow-red-500/50' : itemHealth < 80 ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'}`}></div>
                            </div>

                            <button
                              onClick={(e) => deleteHistoryItem(item.id, e)}
                              className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Delete Scan Record"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                            </button>
                          </div>
                        </div>

                        {/* Middle: Defects Summary Chips */}
                        <div className="py-3 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-600 dark:text-on-surface-variant font-semibold mr-1">
                              Defects: <strong className="text-slate-900 dark:text-on-surface">{item.findings?.length || 0}</strong>
                            </span>
                            {sev.Critical > 0 && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-risk-critical/20 dark:text-risk-critical">
                                {sev.Critical} Critical
                              </span>
                            )}
                            {sev.High > 0 && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-risk-high/20 dark:text-risk-high">
                                {sev.High} High
                              </span>
                            )}
                            {sev.Medium > 0 && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-risk-medium/20 dark:text-risk-medium">
                                {sev.Medium} Medium
                              </span>
                            )}
                            {sev.Low > 0 && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-risk-low/20 dark:text-risk-low">
                                {sev.Low} Low
                              </span>
                            )}
                            {(!sev.Critical && !sev.High && !sev.Medium && !sev.Low) && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                                Clean Code
                              </span>
                            )}
                          </div>

                          {item.prReport?.estimated_fix_time && (
                            <div className="text-xs text-slate-500 dark:text-outline-variant flex items-center gap-1 font-medium">
                              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>build_circle</span>
                              Est. Fix: <span className="font-bold text-slate-800 dark:text-on-surface">{item.prReport.estimated_fix_time}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Toolbar */}
                        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Primary: View Scan Results */}
                            <button
                              onClick={() => viewHistoricalScan(item)}
                              className="bg-indigo-600 dark:bg-primary text-white dark:text-on-primary hover:bg-indigo-700 dark:hover:brightness-110 font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>visibility</span>
                              View Scan Results
                            </button>

                            {/* Download PDF */}
                            <button
                              onClick={() => downloadPDF(item.prReport || {}, item.fixedCode, item.code, item.language, item.findings)}
                              className="bg-slate-100 dark:bg-surface-variant hover:bg-slate-200 dark:hover:brightness-110 text-slate-800 dark:text-on-surface font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border border-slate-200 dark:border-white/5 active:scale-95 transition-all"
                              title="Download / Print PR Summary PDF"
                            >
                              <span className="material-symbols-outlined text-indigo-600 dark:text-primary" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                              Download PDF
                            </button>

                            {/* Copy Report (Markdown) */}
                            <button
                              onClick={() => copyHistoryReport(item)}
                              className="bg-slate-100 dark:bg-surface-variant hover:bg-slate-200 dark:hover:brightness-110 text-slate-800 dark:text-on-surface font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border border-slate-200 dark:border-white/5 active:scale-95 transition-all"
                              title="Copy full markdown report"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                                {isCopied ? 'check' : 'content_copy'}
                              </span>
                              {isCopied ? '✓ Report Copied!' : 'Copy Report'}
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Copy Code */}
                            <button
                              onClick={() => copyHistoryCode(item)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-on-surface-variant dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-variant rounded-md text-xs transition-colors"
                              title={isCodeCopied ? 'Code Copied!' : 'Copy Source Code'}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                                {isCodeCopied ? 'check' : 'code'}
                              </span>
                            </button>

                            {/* Export JSON */}
                            <button
                              onClick={() => downloadHistoryJSON(item)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-on-surface-variant dark:hover:text-white hover:bg-slate-100 dark:hover:bg-surface-variant rounded-md text-xs transition-colors"
                              title="Export JSON Findings"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>data_object</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'results' && result && (
            <div>
              <div className="mb-section-gap flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg mb-2 text-slate-900 dark:text-on-surface font-black">Analysis Results</h1>
                  <p className="text-slate-600 dark:text-on-surface-variant font-medium">Reviewing <span className="font-code-sm text-code-sm text-indigo-700 dark:text-primary font-bold">{result._filename || (mode === 'file' ? file?.name || 'Uploaded File' : generateCodeTitle(result._submittedCode, result._submittedLanguage))}</span></p>
                </div>
                {prReport && (
                  <button 
                    onClick={() => downloadPDF(prReport, fixedCode, result._submittedCode, result._submittedLanguage, result.findings)}
                    className="bg-indigo-600 dark:bg-surface-variant text-white dark:text-on-surface px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-indigo-700 dark:hover:brightness-110 active:scale-95 transition-all duration-200 border border-indigo-700 dark:border-white/10 shadow-md"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Download PR Summary (PDF)
                  </button>
                )}
                {!prReport && prLoading && (
                  <span className="text-slate-600 dark:text-outline-variant text-sm flex items-center gap-2 font-medium"><span className="spin" style={{width: 14, height: 14}}></span> Generating PR Summary...</span>
                )}
              </div>

              {/* Error Analytics & Code Health Dashboard (Replaces Severity-Only Dashboard) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-section-gap">
                {/* Code Health & Key Metrics Overview */}
                <div className="glass-panel rounded-xl p-stack-lg flex flex-col items-center justify-center lg:col-span-4 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${healthScore < 50 ? 'from-red-500/10' : healthScore < 80 ? 'from-amber-500/10' : 'from-emerald-500/10'} to-transparent z-0`}></div>
                  <div className="relative z-10 text-center w-full">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-label-caps text-label-caps text-slate-700 dark:text-outline uppercase tracking-widest font-bold text-xs">Code Health Score</h3>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${healthScore < 50 ? 'bg-red-100 text-red-700 dark:bg-risk-critical/20 dark:text-risk-critical' : healthScore < 80 ? 'bg-amber-100 text-amber-800 dark:bg-risk-medium/20 dark:text-risk-medium' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-500'}`}>
                        {healthScore < 50 ? 'Critical Attention' : healthScore < 80 ? 'Moderate Quality' : 'Clean & Secure'}
                      </span>
                    </div>

                    <div className="relative inline-flex items-center justify-center my-2">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle className="text-slate-200 dark:text-surface-variant" cx="64" cy="64" fill="transparent" r="56" stroke="currentColor" strokeWidth="8"></circle>
                        <circle className={healthScore < 50 ? 'text-red-500 dark:text-risk-critical' : healthScore < 80 ? 'text-amber-500 dark:text-risk-medium' : 'text-emerald-500'} cx="64" cy="64" fill="transparent" r="56" stroke="currentColor" strokeDasharray="351.85" strokeDashoffset={351.85 - (351.85 * healthScore) / 100} strokeLinecap="round" strokeWidth="8" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}></circle>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`font-display-metric text-display-metric font-black ${healthScore < 50 ? 'text-red-600 dark:text-risk-critical' : healthScore < 80 ? 'text-amber-600 dark:text-risk-medium' : 'text-emerald-600 dark:text-emerald-400'}`}>{healthScore}</span>
                        <span className="text-xs text-slate-600 dark:text-on-surface-variant font-bold">/100</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-white/5">
                      <div className="text-center">
                        <div className="text-[11px] text-slate-500 dark:text-outline-variant font-medium">Defects</div>
                        <div className="text-base font-bold text-slate-900 dark:text-on-surface">{findings.length}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[11px] text-slate-500 dark:text-outline-variant font-medium">Blockers</div>
                        <div className="text-base font-bold text-red-600 dark:text-risk-critical">{breakdown.Critical || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[11px] text-slate-500 dark:text-outline-variant font-medium">Est. Fix</div>
                        <div className="text-base font-bold text-emerald-600 dark:text-emerald-500">{prReport?.estimated_fix_time || '15m'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error Analytics Graph: Distribution by Defect Classification & Threat Impact */}
                <div className="glass-panel rounded-xl p-stack-md flex flex-col justify-between lg:col-span-8 relative bg-white dark:bg-surface/70 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h3 className="font-label-caps text-label-caps text-slate-800 dark:text-outline uppercase tracking-widest font-bold text-xs">Error Analytics & Threat Distribution</h3>
                      <p className="text-xs text-slate-600 dark:text-on-surface-variant mt-0.5">Defect occurrences and comparative risk impact across identified code weaknesses</p>
                    </div>
                    <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
                  </div>

                  {errorTypesData.length > 0 ? (
                    <div>
                      <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={errorTypesData} margin={{ top: 10, right: 15, left: -20, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.06)'} />
                            <XAxis
                              dataKey="name"
                              stroke={theme === 'light' ? '#64748b' : '#94a3b8'}
                              tick={{ fontSize: 11.5, fill: theme === 'light' ? '#0f172a' : '#f8fafc', fontWeight: 700 }}
                              interval={0}
                              height={32}
                            />
                            <YAxis stroke={theme === 'light' ? '#64748b' : '#94a3b8'} tick={{ fontSize: 11, fill: theme === 'light' ? '#334155' : '#94a3b8' }} allowDecimals={false} />
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload
                                  return (
                                    <div className="bg-slate-900/95 dark:bg-surface-dim/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 dark:border-white/15 shadow-xl text-xs max-w-xs text-white">
                                      <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: data.fill }}></span>
                                        {data.fullName || data.name}
                                      </div>
                                      <div className="text-slate-300 dark:text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Occurrences:</span>
                                        <strong className="text-white">{data.count} issue{data.count > 1 ? 's' : ''}</strong>
                                      </div>
                                      <div className="text-slate-300 dark:text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Threat Impact Score:</span>
                                        <strong className="text-amber-400">{data.impactScore} pts ({data.causePercentage}% of total)</strong>
                                      </div>
                                      <div className="text-slate-300 dark:text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Severity:</span>
                                        <strong className={`text-${sevCls(data.highestSev)}`}>{data.highestSev}</strong>
                                      </div>
                                      <div className="mt-1 text-[10px] text-indigo-300 italic">Click bar to view full details below</div>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Bar
                              dataKey="count"
                              radius={[6, 6, 0, 0]}
                              cursor="pointer"
                              onClick={(entry) => setSelectedError(selectedError?.name === entry.name ? null : entry)}
                            >
                              {errorTypesData.map((entry, index) => (
                                <Cell
                                  key={`bar-cell-${index}`}
                                  fill={entry.fill}
                                  opacity={selectedError ? (selectedError.name === entry.name ? 1 : 0.45) : 1}
                                  stroke={selectedError?.name === entry.name ? (theme === 'light' ? '#4338ca' : '#ffffff') : 'none'}
                                  strokeWidth={2}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Clickable Bar Details Callout */}
                      {selectedError ? (
                        <div className="mt-3 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/90 dark:bg-indigo-950/40 backdrop-blur-md animate-tooltip-in">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedError.fill }}></span>
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{selectedError.fullName || selectedError.name}</h4>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${selectedError.highestSev === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-risk-critical/20 dark:text-risk-critical' : selectedError.highestSev === 'High' ? 'bg-orange-100 text-orange-700 dark:bg-risk-high/20 dark:text-risk-high' : 'bg-amber-100 text-amber-800 dark:bg-risk-medium/20 dark:text-risk-medium'}`}>
                                  {selectedError.highestSev}
                                </span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-surface-variant px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10">
                                  {selectedError.count} issue{selectedError.count > 1 ? 's' : ''} &bull; {selectedError.causePercentage}% total cause
                                </span>
                              </div>
                              {selectedError.description && (
                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{selectedError.description}</p>
                              )}
                              {selectedError.lines && selectedError.lines.length > 0 && (
                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono font-medium">
                                  Affected: Line {selectedError.lines.join(', Line ')}
                                </div>
                              )}
                              {selectedError.recommendation && (
                                <div className="text-xs text-indigo-950 dark:text-indigo-200 mt-1.5 font-medium bg-white dark:bg-indigo-900/30 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800/40 leading-relaxed">
                                  <strong className="text-indigo-700 dark:text-indigo-300">Actionable Remediation:</strong> {selectedError.recommendation}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedError(null)}
                              className="text-slate-500 hover:text-slate-800 dark:hover:text-white p-1 rounded-lg hover:bg-white/80 dark:hover:bg-white/10 transition-all text-xs font-bold"
                              title="Close details"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-center text-xs text-slate-500 dark:text-outline-variant py-1 font-medium">
                          <span>👆 Click any bar above to inspect full defect details, affected lines, and actionable remediation.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-outline-variant py-10">
                      <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">analytics</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-on-surface">Zero Errors Found</span>
                      <span className="text-xs text-slate-500 dark:text-outline-variant mt-1">No defect analytics to graph.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Types & Cause Impact Dashboard Graph */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-section-gap">
                {/* Error Types & Cause Pie Chart */}
                <div className="glass-panel rounded-xl p-stack-lg flex flex-col items-center justify-between lg:col-span-5 relative bg-white dark:bg-surface/70 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
                  <div className="w-full flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-label-caps text-label-caps text-slate-800 dark:text-outline uppercase tracking-widest font-bold text-xs">Error Types & Causes</h3>
                      <p className="text-xs text-slate-600 dark:text-on-surface-variant mt-0.5">Distribution of error types and the amount of cause they contribute</p>
                    </div>
                    <span className="material-symbols-outlined text-indigo-600 dark:text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>pie_chart</span>
                  </div>

                  {errorTypesData.length > 0 ? (
                    <div className="w-full flex flex-col items-center">
                      <div style={{ width: '100%', height: 210 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={errorTypesData}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={78}
                              paddingAngle={4}
                              dataKey="impactScore"
                              stroke={theme === 'light' ? '#ffffff' : '#13131b'}
                              strokeWidth={2}
                            >
                              {errorTypesData.map((entry, index) => (
                                <Cell key={`error-cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload
                                  return (
                                    <div className="bg-slate-900/95 dark:bg-surface-dim/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 dark:border-white/15 shadow-xl text-xs max-w-xs text-white">
                                      <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: data.fill }}></span>
                                        {data.fullName || data.name}
                                      </div>
                                      <div className="text-slate-300 dark:text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Occurrences:</span>
                                        <strong className="text-white">{data.count}</strong>
                                      </div>
                                      <div className="text-slate-300 dark:text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Cause Contribution:</span>
                                        <strong className="text-emerald-400">{data.causePercentage}% of total risk</strong>
                                      </div>
                                      <div className="text-slate-300 dark:text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Highest Severity:</span>
                                        <strong className={`text-${sevCls(data.highestSev)}`}>{data.highestSev}</strong>
                                      </div>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-sm">
                        {errorTypesData.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedError(selectedError?.name === item.name ? null : item)}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                              selectedError?.name === item.name
                                ? 'bg-indigo-100 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 font-bold'
                                : 'bg-slate-100 dark:bg-surface-dim/70 border-slate-200 dark:border-white/5 text-slate-700 dark:text-on-surface-variant hover:border-indigo-300'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }}></span>
                            <span className="font-semibold text-slate-800 dark:text-on-surface truncate max-w-[130px]">{item.name}</span>
                            <span className="text-slate-500 dark:text-outline font-bold">({item.causePercentage}%)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-outline-variant py-10">
                      <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">verified</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-on-surface">No Defects Detected</span>
                      <span className="text-xs text-slate-500 dark:text-outline-variant mt-1">100% Clean Codebase</span>
                    </div>
                  )}
                </div>

                {/* Detailed Error Types & Cause Impact Breakdown Panel */}
                <div className="glass-panel rounded-xl p-stack-lg flex flex-col justify-between lg:col-span-7 relative bg-white dark:bg-surface/70 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
                  <div className="mb-4">
                    <h3 className="font-label-caps text-label-caps text-slate-800 dark:text-outline uppercase tracking-widest font-bold text-xs">Cause Impact & Defect Breakdown</h3>
                    <p className="text-xs text-slate-600 dark:text-on-surface-variant">Breakdown of specific defect classifications and the amount of cause they are causing</p>
                  </div>

                  {errorTypesData.length > 0 ? (
                    <div className="space-y-3.5 overflow-y-auto max-h-[300px] pr-1">
                      {errorTypesData.map((item, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedError(selectedError?.name === item.name ? null : item)}
                          className={`rounded-xl p-3 border cursor-pointer transition-all ${
                            selectedError?.name === item.name
                              ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-400/20'
                              : 'bg-slate-50 dark:bg-surface-dim/70 border-slate-200 dark:border-white/5 hover:border-indigo-300 dark:hover:border-white/15'
                          } shadow-sm dark:shadow-none`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }}></span>
                              <span className="font-bold text-sm text-slate-900 dark:text-on-surface">{item.fullName || item.name}</span>
                              <span className="bg-slate-200 dark:bg-surface-variant text-slate-700 dark:text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-full">{item.count} issue{item.count > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${item.highestSev === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-risk-critical/20 dark:text-risk-critical' : item.highestSev === 'High' ? 'bg-orange-100 text-orange-700 dark:bg-risk-high/20 dark:text-risk-high' : 'bg-amber-100 text-amber-800 dark:bg-risk-medium/20 dark:text-risk-medium'}`}>
                                {item.highestSev}
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-on-surface">{item.causePercentage}% cause</span>
                            </div>
                          </div>
                          
                          {/* Progress bar for cause percentage */}
                          <div className="w-full bg-slate-200 dark:bg-surface-variant h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${item.causePercentage}%`, backgroundColor: item.fill }}
                            ></div>
                          </div>

                          {item.description && (
                            <p className="text-xs text-slate-600 dark:text-on-surface-variant mt-2 line-clamp-1 truncate font-medium">{item.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-outline-variant py-10">
                      <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-on-surface">Zero Security Flaws Identified</span>
                      <span className="text-xs text-slate-500 dark:text-outline-variant mt-1">Uploaded code passed all static and heuristic checks.</span>
                    </div>
                  )}
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
                      
                      <div className="flex items-center gap-2">
                        {showFixedCode && fixedCode && (
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(fixedCode)
                              setCopiedFixed(true)
                              setTimeout(() => setCopiedFixed(false), 2000)
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-surface-dim hover:bg-surface-variant text-xs text-white rounded border border-white/10 transition-colors"
                            title="Copy Fixed Code"
                          >
                            <span className="material-symbols-outlined" style={{fontSize: '15px'}}>{copiedFixed ? 'check' : 'content_copy'}</span>
                            {copiedFixed ? 'Copied' : 'Copy Code'}
                          </button>
                        )}
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
      <ChatWidget currentCode={result?._submittedCode} currentFindings={result?.findings} />
    </>
  )
}
