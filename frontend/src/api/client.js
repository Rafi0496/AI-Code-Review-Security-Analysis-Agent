// Direct API client for ai_code_review FastAPI backend
const BASE = import.meta.env.VITE_API_URL || 'https://ai-code-review-security-analysis-agent.onrender.com'

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function postForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  /** Analyze pasted code text */
  analyzeText: (code, language, filename) =>
    post('/analyze/text', { code, language, filename }),

  /** Analyze an uploaded File object */
  analyzeFile: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return postForm('/analyze/file', fd)
  },

  /** Query the OWASP RAG knowledge base */
  askRAG: (query, context = "", top_k = 5) =>
    post('/rag/query', { question: query, context }),

  /** Ping the backend */
  ping: () =>
    fetch(`${BASE}/health`)
      .then(r => r.ok)
      .catch(() => false),
}
