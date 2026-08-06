"""
RAG Conversational Agent — Handles context-aware Q&A using:
1. Retrieval from ChromaDB knowledge base
2. Review context injection
3. Gemini for response generation
"""
import re
from google import genai
from google.genai import types
from core.config import settings
from rag.knowledge_base import knowledge_base

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.google_api_key)
    return _client

RAG_CHAT_PROMPT = """You are an expert AI Code Review Assistant with deep knowledge of:
- Secure coding practices (OWASP, CERT, CWE)
- Code quality and design patterns
- Security vulnerability remediation
- Python, Java, JavaScript, and TypeScript best practices

You are helping a developer understand findings from their code review.

## Review Context
{review_context}

## Relevant Knowledge Base Information
{rag_context}

## Conversation History
{chat_history}

## Developer's Question
{question}

Provide a clear, helpful, and technically accurate response.
- Reference specific findings from the review when relevant
- Cite OWASP categories or CWE IDs when discussing security issues
- Provide code examples when they would help clarify your answer
- Be educational but concise
- If you don't know something, say so honestly"""


async def generate_chat_response(
    question: str,
    review_context: dict,
    chat_history: list[dict],
) -> str:
    """
    Generate a RAG-powered response to a developer question.

    Args:
        question: The developer's question
        review_context: The review results dict (code_analysis, security_analysis, etc.)
        chat_history: List of {"role": "user"|"assistant", "content": str}

    Returns:
        AI-generated response string
    """
    # Step 1: Retrieve relevant documents from knowledge base
    rag_docs = await knowledge_base.query(question, n_results=4)
    rag_context = "\n\n".join([
        f"[{doc['metadata'].get('title', 'Reference')}]\n{doc['text']}"
        for doc in rag_docs
    ]) if rag_docs else "No specific references retrieved for this query."

    # Step 2: Build review context summary
    review_summary = _build_review_summary(review_context)

    # Step 3: Build conversation history string
    history_str = ""
    for msg in chat_history[-6:]:  # Last 6 messages for context
        role = "Developer" if msg["role"] == "user" else "Assistant"
        history_str += f"\n{role}: {msg['content']}\n"

    prompt = RAG_CHAT_PROMPT.format(
        review_context=review_summary,
        rag_context=rag_context,
        chat_history=history_str or "No previous conversation.",
        question=question,
    )

    try:
        response = _get_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.5,
                max_output_tokens=2048,
            ),
        )
        return response.text.strip()
    except Exception as e:
        return f"I encountered an error generating a response: {str(e)}. Please try again."


def _build_review_summary(review_context: dict) -> str:
    """Build a concise review summary string for the prompt."""
    if not review_context:
        return "No review context available. I'll answer based on general knowledge."

    parts = []

    ca = review_context.get("code_analysis", {})
    if ca:
        parts.append(f"Code Quality Score: {ca.get('quality_score', 'N/A')}/100")
        parts.append(f"Maintainability: {ca.get('maintainability_rating', 'N/A')}")

    sa = review_context.get("security_analysis", {})
    if sa:
        parts.append(f"Security Risk Level: {sa.get('risk_level', 'N/A')}")
        vulns = sa.get("vulnerabilities", [])
        if vulns:
            vuln_list = ", ".join([v.get("title", "") for v in vulns[:3]])
            parts.append(f"Key Vulnerabilities: {vuln_list}")

    stats = review_context.get("stats", {})
    if stats:
        parts.append(f"Total Findings: {stats.get('total_findings', 0)}")

    pr = review_context.get("pr_summary", {})
    if pr:
        parts.append(f"Review Verdict: {pr.get('verdict', 'N/A')}")

    return "\n".join(parts) if parts else "Review context available but empty."
