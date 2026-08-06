"""
Remediation Agent — Generates specific fix recommendations with corrected code examples
and best practice explanations for every finding from Code Analysis and Security agents.
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

REMEDIATION_PROMPT = """You are an expert software engineer and security consultant.
Based on the findings from code analysis and security analysis, generate specific,
actionable remediation recommendations with corrected code examples.

Language: {language}

Original Source Code:
```{language}
{code}
```

Code Analysis Findings:
{code_findings}

Security Vulnerability Findings:
{security_findings}

For each finding, provide:
1. A clear explanation of WHY it is a problem
2. The CORRECTED code or pattern
3. Best practice guidance to prevent recurrence

Return your remediation as a JSON object with this exact structure:
{{
  "remediation_summary": "Overall remediation strategy (2-3 sentences)",
  "effort_estimate": "Low|Medium|High",
  "remediations": [
    {{
      "finding_title": "Title matching the original finding",
      "severity": "critical|high|medium|low|info",
      "category": "Security|Code Quality|Design|Documentation",
      "explanation": "Why this is a problem and what risks it poses",
      "before_code": "The problematic code snippet",
      "after_code": "The corrected/improved code",
      "best_practice": "General guideline to follow going forward",
      "references": ["OWASP link or coding standard reference"]
    }}
  ],
  "refactoring_roadmap": [
    {{
      "priority": 1,
      "action": "What to do",
      "estimated_effort": "30 minutes|2 hours|1 day"
    }}
  ]
}}

Make code examples realistic and directly applicable to the submitted code.
Return ONLY valid JSON."""


async def run_remediation(
    code: str,
    language: str,
    code_analysis: dict,
    security_analysis: dict,
) -> dict:
    """
    Run the Remediation Agent using Gemini.
    Receives findings from both prior agents and generates fix recommendations.
    """
    # Extract findings for the prompt
    code_findings = json.dumps(code_analysis.get("findings", []), indent=2)
    security_findings = json.dumps(security_analysis.get("vulnerabilities", []), indent=2)

    prompt = REMEDIATION_PROMPT.format(
        language=language,
        code=code,
        code_findings=code_findings,
        security_findings=security_findings,
    )

    try:
        response = _get_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
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
            "remediation_summary": "Remediation generation completed with parsing issues.",
            "effort_estimate": "Medium",
            "remediations": [],
            "refactoring_roadmap": [],
            "error": str(e),
        }
    except Exception as e:
        return {
            "remediation_summary": f"Remediation encountered an error: {str(e)}",
            "effort_estimate": "Unknown",
            "remediations": [],
            "refactoring_roadmap": [],
            "error": str(e),
        }
