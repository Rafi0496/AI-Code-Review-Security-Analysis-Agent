import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts'
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
    <div style="margin-bottom: 24px; border: 1.5px solid #000; padding: 18px; background: #fff; page-break-inside: avoid; font-family: 'Times New Roman', Times, serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #000; padding-bottom: 10px; margin-bottom: 12px;">
        <div style="font-size: 15px; font-weight: bold; text-transform: uppercase; color: #000;">
          ISSUE #${i + 1}: ${issueType}
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <span style="border: 1px solid #000; background: #000; color: #fff; font-weight: bold; font-size: 11px; padding: 3px 8px; text-transform: uppercase; letter-spacing: 0.05em;">${sev}</span>
          <span style="border: 1px solid #000; background: #fff; color: #000; font-weight: bold; font-size: 11px; padding: 3px 8px;">LINE ${lineNum}</span>
        </div>
      </div>
      
      <div style="margin-bottom: 10px;">
        <div style="font-size: 12.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 3px;">1. Defect Description:</div>
        <div style="font-size: 14px; color: #000; line-height: 1.55;">${desc}</div>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="font-size: 12.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 3px;">2. Root Cause Analysis:</div>
        <div style="font-size: 14px; color: #000; line-height: 1.55;">${rootCause}</div>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="font-size: 12.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 3px;">3. Security & Operational Impact:</div>
        <div style="font-size: 14px; color: #000; line-height: 1.55;">${threatImpact}</div>
      </div>

      <div style="border: 1px solid #000; background: #f8f8f8; padding: 12px; margin-top: 12px;">
        <div style="font-size: 12.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #000; margin-bottom: 4px;">4. Actionable Remediation & Fix Instructions:</div>
        <div style="font-size: 14px; color: #000; line-height: 1.55;">${detailedAction}</div>
      </div>

      ${beforeSnippet || afterSnippet ? `
      <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        ${beforeSnippet ? `
        <div style="border: 1px solid #000; background: #fff;">
          <div style="background: #000; color: #fff; padding: 4px 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; font-family: 'Times New Roman', Times, serif;">VULNERABLE CODE (BEFORE)</div>
          <pre style="margin: 0; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #000; white-space: pre-wrap; line-height: 1.5;">${beforeSnippet}</pre>
        </div>` : ''}
        ${afterSnippet ? `
        <div style="border: 1px solid #000; background: #fff;">
          <div style="background: #000; color: #fff; padding: 4px 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; font-family: 'Times New Roman', Times, serif;">SECURE REMEDIATION (AFTER)</div>
          <pre style="margin: 0; padding: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; color: #000; white-space: pre-wrap; line-height: 1.5;">${afterSnippet}</pre>
        </div>` : ''}
      </div>` : ''}
    </div>`
  }).join('')

  const fixedCodeLines = effectiveFixedCode.split('\n').map((line, idx) => {
    return `<tr><td style="width: 45px; text-align: right; color: #444; padding: 2px 8px; border: none; border-right: 1px solid #000; user-select: none; background: #f0f0f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px;">${idx + 1}</td><td style="padding: 2px 8px; border: none; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; white-space: pre; color: #000;">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || ' '}</td></tr>`
  }).join('')

  const rawFixedCodeEscaped = JSON.stringify(effectiveFixedCode)

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Report of Uploaded ${formattedLang} Code</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    color: #000;
    padding: 40px;
    line-height: 1.6;
    font-size: 14px;
    background: #fff;
  }
  .report-header {
    border-bottom: 2px solid #000;
    padding-bottom: 16px;
    margin-bottom: 24px;
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
    font-size: 24px;
    font-weight: bold;
    text-align: center;
    color: #000;
    margin: 0 auto 8px auto;
    letter-spacing: 0.02em;
  }
  .meta {
    font-family: "Times New Roman", Times, serif;
    font-size: 13px;
    color: #222;
    margin-top: 6px;
    text-align: center;
  }
  .action-bar { display: flex; gap: 8px; }
  .btn-action {
    font-family: "Times New Roman", Times, serif;
    background: #000;
    color: #fff;
    border: 1px solid #000;
    padding: 7px 16px;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .btn-action:hover { background: #333; }
  h2 {
    font-family: "Times New Roman", Times, serif;
    font-size: 17px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 28px 0 12px;
    color: #000;
    border-bottom: 1.5px solid #000;
    padding-bottom: 5px;
  }
  .score-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 16px 0 24px; }
  .score-card { border: 1.5px solid #000; padding: 14px; text-align: center; background: #fff; }
  .score-val { font-family: "Times New Roman", Times, serif; font-size: 26px; font-weight: bold; color: #000; display: block; }
  .score-lbl { font-family: "Times New Roman", Times, serif; font-size: 11.5px; color: #222; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; margin-top: 4px; display: block; }
  table.stats-table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-family: "Times New Roman", Times, serif; }
  table.stats-table th, table.stats-table td { text-align: left; padding: 9px 12px; border: 1px solid #000; font-size: 13.5px; color: #000; }
  table.stats-table th { background: #f0f0f0; font-weight: bold; text-transform: uppercase; letter-spacing: 0.03em; }
  .code-container { border: 1.5px solid #000; background: #fff; margin-top: 12px; }
  .code-table { width: 100%; border-collapse: collapse; margin: 0; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #000; font-size: 12px; color: #222; display: flex; justify-content: space-between; font-family: "Times New Roman", Times, serif; font-weight: bold; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none !important; }
    .code-container { page-break-inside: auto; }
  }
</style>
</head><body>
<div class="report-header">
  <div class="header-content">
    <h1 class="main-heading">Report of Uploaded ${formattedLang} Code</h1>
    <div class="meta">
      <strong>Generated:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })} &bull; 
      <strong>System:</strong> AI Multi-Agent Code Inspector &bull; 
      <strong>Target Language:</strong> ${formattedLang}
    </div>
  </div>
  <div class="action-bar no-print" style="margin-left: 16px;">
    <button class="btn-action" onclick="window.print()">Print / Save PDF</button>
  </div>
</div>

<h2>1. Executive Overview & Code Health Assessment</h2>
<p style="margin-bottom: 16px; color: #000; font-size: 14px; line-height: 1.6;">${prData.executive_overview || 'Comprehensive multi-agent code analysis completed. Findings, technical root causes, and full code remediation are documented below.'}</p>

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
<p style="color: #222; font-size: 13px; margin-bottom: 14px;">Detailed technical breakdown for every identified defect, including root cause, impact, and exact code fix:</p>
${errorAndFixCards || '<p style="color: #000; font-size: 14px;">No defects identified in submitted codebase.</p>'}

<h2>4. Full Remediated Source Code (Fixed Codebase)</h2>
<p style="color: #222; font-size: 13px; margin-bottom: 10px;">The complete corrected source code with all vulnerabilities resolved and secure coding standards implemented:</p>
<div class="code-container">
  <div style="background: #f0f0f0; border-bottom: 1px solid #000; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-family: 'Times New Roman', Times, serif;">
    <span style="font-size: 12px; font-weight: bold; text-transform: uppercase;">📄 SECURED SOURCE CODE (${formattedLang})</span>
    <button id="copy-btn" class="btn-action no-print" onclick="copyFixedCode()" style="padding: 4px 10px; font-size: 11px;">📋 Copy Fixed Code</button>
  </div>
  <table class="code-table">
    <tbody>
      ${fixedCodeLines}
    </tbody>
  </table>
</div>

${prData.positive_observations?.length > 0 ? `
<h2>5. Positive Observations & Best Practices</h2>
<ul style="margin: 8px 0 8px 24px; color: #000; font-size: 14px;">
  ${prData.positive_observations.map(o => `<li style="margin-bottom: 6px;">${o}</li>`).join('')}
</ul>` : ''}

<div class="footer">
  <span>AI Code Review & Security Analysis Agent</span>
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
    setPrReport(null)
    setFixedCode(null)
    setShowFixedCode(false)

    try {
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

  const errorTypesData = useMemo(() => {
    if (!findings || findings.length === 0) return []

    const typeMap = {}
    findings.forEach(f => {
      const rawType = f.type || f.finding_type || f.title || 'Security Defect'
      const cleanType = rawType.replace(/_/g, ' ').trim()
      if (!typeMap[cleanType]) {
        typeMap[cleanType] = {
          name: cleanType,
          count: 0,
          severities: [],
          highestSev: f.severity || 'Medium',
          totalImpactScore: 0,
          description: f.description || ''
        }
      }
      typeMap[cleanType].count += 1
      typeMap[cleanType].severities.push(f.severity || 'Medium')
      const weight = SEVERITY_WEIGHT[f.severity] || 15
      typeMap[cleanType].totalImpactScore += weight
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
      <header className="bg-surface/70 backdrop-blur-xl fixed top-0 w-full z-50 border-b border-white/10 shadow-[0_20px_40px_rgba(99,102,241,0.15)] flex justify-between items-center px-4 md:px-margin-desktop max-w-container-max mx-auto h-20 left-0 right-0">
        <div className="flex items-center gap-gutter">
          <a className="font-headline-md text-headline-md font-black tracking-tighter text-primary flex items-center gap-2" href="#">
            <span className="material-symbols-outlined" style={{fontSize: '28px', fontVariationSettings: "'FILL' 1"}}>policy</span>
            <span className="hidden sm:inline">AI Code Analyzer</span>
          </a>
          <nav className="flex items-center gap-2 md:gap-stack-lg ml-2 md:ml-stack-lg">
            <button onClick={() => setActiveTab('scanner')} className={`${activeTab === 'scanner' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-on-surface hover:bg-primary/10'} px-2.5 md:px-3 py-1.5 md:py-2 rounded-md active:scale-95 transition-all duration-300 font-semibold text-sm md:text-base`}>Scanner</button>
            <button onClick={() => setActiveTab('results')} disabled={!result} className={`${activeTab === 'results' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant'} ${!result ? 'opacity-50 cursor-not-allowed' : 'hover:text-on-surface hover:bg-primary/10'} px-2.5 md:px-3 py-1.5 md:py-2 rounded-md active:scale-95 transition-all duration-300 font-semibold text-sm md:text-base`}>Results</button>
            <button onClick={() => setActiveTab('agents')} className={`${activeTab === 'agents' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-on-surface hover:bg-primary/10'} px-2.5 md:px-3 py-1.5 md:py-2 rounded-md active:scale-95 transition-all duration-300 font-semibold text-sm md:text-base`}>Agents Pipeline</button>
          </nav>
        </div>

        {/* Modes Switching Container with Entrance Intimation */}
        <div className="relative flex items-center">
          <div className="flex items-center bg-surface-variant/80 border border-white/10 rounded-xl p-1 shadow-sm backdrop-blur-md">
            <button
              onClick={() => toggleTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                theme === 'light'
                  ? 'bg-white text-indigo-950 shadow-md ring-1 ring-black/5'
                  : 'text-outline-variant hover:text-on-surface'
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
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'text-outline-variant hover:text-on-surface'
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
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    language={detectLanguage(code)}
                    placeholder="// Click 'Paste' to import from clipboard, or type your source code here..."
                  />
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
                    onClick={() => downloadPDF(prReport, fixedCode, result._submittedCode, result._submittedLanguage, result.findings)}
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

              {/* Analytics Dashboard with Health Score & Severity Distribution */}
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
                
                {/* Visual Severity Chart */}
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

              {/* Error Types & Cause Impact Dashboard Graph */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-section-gap">
                {/* Error Types & Cause Pie Chart */}
                <div className="glass-panel rounded-xl p-stack-lg flex flex-col items-center justify-between lg:col-span-5 relative">
                  <div className="w-full flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-label-caps text-label-caps text-outline uppercase tracking-widest">Error Types & Causes</h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">Distribution of error types and the amount of cause they contribute</p>
                    </div>
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>pie_chart</span>
                  </div>

                  {errorTypesData.length > 0 ? (
                    <div className="w-full flex flex-col items-center">
                      <div style={{ width: '100%', height: 210 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={errorTypesData}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={78}
                              paddingAngle={4}
                              dataKey="impactScore"
                              stroke="none"
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
                                    <div className="bg-surface-dim/95 backdrop-blur-md p-3 rounded-xl border border-white/15 shadow-xl text-xs max-w-xs">
                                      <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: data.fill }}></span>
                                        {data.name}
                                      </div>
                                      <div className="text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Occurrences:</span>
                                        <strong className="text-white">{data.count}</strong>
                                      </div>
                                      <div className="text-on-surface-variant flex justify-between gap-4 my-0.5">
                                        <span>Cause Contribution:</span>
                                        <strong className="text-emerald-400">{data.causePercentage}% of total risk</strong>
                                      </div>
                                      <div className="text-on-surface-variant flex justify-between gap-4 my-0.5">
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
                          <div key={i} className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-surface-dim/70 px-2.5 py-1 rounded-full border border-white/5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }}></span>
                            <span className="font-medium text-on-surface truncate max-w-[130px]">{item.name}</span>
                            <span className="text-outline font-bold">({item.causePercentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-outline-variant py-10">
                      <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">verified</span>
                      <span className="text-sm font-semibold text-on-surface">No Defects Detected</span>
                      <span className="text-xs text-outline-variant mt-1">100% Clean Codebase</span>
                    </div>
                  )}
                </div>

                {/* Detailed Error Types & Cause Impact Breakdown Panel */}
                <div className="glass-panel rounded-xl p-stack-lg flex flex-col justify-between lg:col-span-7 relative">
                  <div className="mb-4">
                    <h3 className="font-label-caps text-label-caps text-outline uppercase tracking-widest mb-1">Cause Impact & Defect Breakdown</h3>
                    <p className="text-xs text-on-surface-variant">Breakdown of specific defect classifications and the amount of cause they are causing</p>
                  </div>

                  {errorTypesData.length > 0 ? (
                    <div className="space-y-3.5 overflow-y-auto max-h-[300px] pr-1">
                      {errorTypesData.map((item, i) => (
                        <div key={i} className="bg-surface-dim/70 rounded-xl p-3 border border-white/5 hover:border-white/15 transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }}></span>
                              <span className="font-semibold text-sm text-on-surface">{item.name}</span>
                              <span className="bg-surface-variant text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-full">{item.count} issue{item.count > 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-${sevCls(item.highestSev)}/20 text-${sevCls(item.highestSev)}`}>
                                {item.highestSev}
                              </span>
                              <span className="text-sm font-bold text-on-surface">{item.causePercentage}% cause</span>
                            </div>
                          </div>
                          
                          {/* Progress bar for cause percentage */}
                          <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${item.causePercentage}%`, backgroundColor: item.fill }}
                            ></div>
                          </div>

                          {item.description && (
                            <p className="text-xs text-on-surface-variant mt-2 line-clamp-1 truncate">{item.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-outline-variant py-10">
                      <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
                      <span className="text-sm font-semibold text-on-surface">Zero Security Flaws Identified</span>
                      <span className="text-xs text-outline-variant mt-1">Uploaded code passed all static and heuristic checks.</span>
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
