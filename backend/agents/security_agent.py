"""
Security Vulnerability Agent — Scans for OWASP Top 10 vulnerabilities:
SQL Injection, XSS, CSRF, hardcoded secrets, insecure auth, broken access controls.
Uses Google Gemini for deep semantic vulnerability detection.
"""
import json
import re
import google.generativeai as genai
from google.genai import types
from core.config import settings

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.google_api_key)
    return _client

SECURITY_ANALYSIS_PROMPT = """You are an expert application security engineer specializing in OWASP Top 10 vulnerabilities.
Perform a comprehensive security analysis of the provided source code.

Focus on detecting:
- **A01: Broken Access Control** — Missing authorization checks, privilege escalation paths
- **A02: Cryptographic Failures** — Weak algorithms, hardcoded secrets, unencrypted sensitive data
- **A03: Injection** — SQL injection, command injection, LDAP injection, XSS
- **A04: Insecure Design** — Missing security controls, flawed business logic
- **A05: Security Misconfiguration** — Default configs, verbose errors, unnecessary features
- **A06: Vulnerable Components** — Outdated imports, known vulnerable patterns
- **A07: Authentication Failures** — Weak passwords, broken session management, missing MFA
- **A08: Integrity Failures** — Unsafe deserialization, unverified updates
- **A09: Logging Failures** — Sensitive data in logs, insufficient logging
- **A10: Server-Side Request Forgery** — Unvalidated URLs, SSRF patterns

Language: {language}

Source Code:
```{language}
{code}
```

Return your security analysis as a JSON object with this exact structure:
{{
  "security_summary": "Overall security assessment (2-3 sentences)",
  "risk_level": "Critical|High|Medium|Low|Minimal",
  "vulnerabilities": [
    {{
      "severity": "critical|high|medium|low|info",
      "owasp_category": "A01:2021|A02:2021|A03:2021|A04:2021|A05:2021|A06:2021|A07:2021|A08:2021|A09:2021|A10:2021",
      "vulnerability_type": "SQL Injection|XSS|Hardcoded Secret|...",
      "title": "Short vulnerability title",
      "description": "Detailed explanation of the vulnerability",
      "affected_code": "The specific vulnerable code snippet",
      "line_number": <integer or null>,
      "impact": "What an attacker could do if this is exploited",
      "cwe_id": "CWE-XXX",
      "recommendation": "How to fix this vulnerability"
    }}
  ],
  "secure_coding_observations": ["Positive security practices found"],
  "critical_actions": ["Immediate actions required before deployment"]
}}

Be precise and cite specific code patterns. Return ONLY valid JSON."""


async def run_security_analysis(code: str, language: str) -> dict:
    """
    Run the Security Vulnerability Agent using Gemini.
    Returns structured JSON with OWASP-categorized vulnerabilities.
    """
    prompt = SECURITY_ANALYSIS_PROMPT.format(language=language, code=code)

    try:
        response = _get_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,  # Low temperature for more deterministic security findings
                max_output_tokens=8192,
            ),
        )

        text = response.text.strip()
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

        result = json.loads(text)
        return result

    except json.JSONDecodeError as e:
        return {
            "security_summary": "Security analysis completed with parsing issues.",
            "risk_level": "Medium",
            "vulnerabilities": [],
            "secure_coding_observations": [],
            "critical_actions": ["Manually review code for security vulnerabilities."],
            "error": str(e),
        }
    except Exception as e:
        return {
            "security_summary": f"Security analysis encountered an error: {str(e)}",
            "risk_level": "Unknown",
            "vulnerabilities": [],
            "secure_coding_observations": [],
            "critical_actions": [],
            "error": str(e),
        }
