import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { chatAPI, reviewsAPI } from '../api/client'
import ReactMarkdown from 'react-markdown'

const SUGGESTIONS = [
  'Explain the SQL injection vulnerability found in my code',
  'How do I fix the hardcoded secret issue?',
  'What is OWASP A03 injection and why is it dangerous?',
  'Show me a secure way to handle database queries in Python',
  'What are the most critical issues I should fix first?',
  'Explain the difference between XSS and SQL injection',
]

export default function Chat() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const reviewId = searchParams.get('review')

  const [reviews, setReviews] = useState([])
  const [selectedReview, setSelectedReview] = useState(reviewId || '')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    reviewsAPI.list()
      .then(res => {
        setReviews(res.data)
        if (!selectedReview && res.data.length > 0) setSelectedReview(res.data[0].id)
      })
      .finally(() => setInitializing(false))
  }, [])

  useEffect(() => {
    if (selectedReview) {
      chatAPI.history(selectedReview).then(res => setMessages(res.data)).catch(() => setMessages([]))
    }
  }, [selectedReview])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || !selectedReview || loading) return

    setInput('')
    setMessages(m => [...m, { role: 'user', content: msg, created_at: new Date().toISOString() }])
    setLoading(true)

    try {
      const res = await chatAPI.send(selectedReview, msg)
      setMessages(m => [...m, { role: 'assistant', content: res.data.response, created_at: new Date().toISOString() }])
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `Sorry, I encountered an error: ${err.response?.data?.detail || err.message}`, created_at: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="page-content" style={{ paddingBottom: 0 }}>
      <div className="page-title-row" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>💬 AI Code Assistant</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>RAG-powered Q&A grounded in your review + secure coding knowledge base</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select className="select" style={{ width: 'auto' }} value={selectedReview} onChange={e => setSelectedReview(e.target.value)}>
            <option value="">Select a review</option>
            {reviews.map(r => (
              <option key={r.id} value={r.id}>Review {r.id.slice(0, 8)}… ({r.total_findings} findings)</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedReview ? (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>Select a Review</h3>
          <p>Choose a code review above to start asking questions about it</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/submit')}>Submit Code First →</button>
        </div>
      ) : (
        <div className="chat-container">
          {/* Messages */}
          <div className="chat-messages" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border-subtle)', borderBottom: 'none' }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤖</div>
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  Ask me anything about your code review, security findings, or secure coding practices.
                </p>
                <div style={{ fontSize: '0.8rem', background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  💡 I'm grounded in OWASP guidelines, secure coding references, and your specific review findings.
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role} animate-fade-in`}>
                <div className={`chat-avatar ${msg.role}`}>
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="chat-bubble">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <div className="chat-avatar assistant">🤖</div>
                <div className="chat-bubble" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', animation: `typing 1.2s ${i * 0.2}s ease infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-area" style={{ borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', border: '1px solid var(--border-subtle)', borderTop: 'none' }}>
            {messages.length === 0 && (
              <div className="chat-suggestions">
                {SUGGESTIONS.slice(0, 3).map(s => (
                  <button key={s} className="chat-suggestion" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            )}
            <div className="chat-input-row">
              <textarea
                className="chat-input"
                placeholder="Ask about your review findings, security issues, or coding best practices..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{ minWidth: 52, justifyContent: 'center' }}
              >
                {!loading && '→'}
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
              Press Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
