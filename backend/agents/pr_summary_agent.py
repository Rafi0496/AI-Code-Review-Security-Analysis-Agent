"""
PR Summary Agent — Compiles all agent findings into a structured,
human-readable pull request style review summary.
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

PR_SUMMARY_PROMPT = """You are a senior engineering lead writing a pull request review.
Synthesize all findings from code analysis, security analysis, and remediation into a
clear, structured PR review summary suitable for a developer to read and act on.

Language: {language}
Filename: {filename}
Lines of Code: {line_count}

Code Analysis Summary:
{code_summary}

Security Analysis Summary:
{security_summary}

Remediation Strategy:
{remediation_summary}

Total Findings: {total_findings}
Severity Breakdown: Critical={critical}, High={high}, Medium={medium}, Low={low}, Info={info}

Generate a professional PR review summary as a JSON object:
{{
  "pr_title": "PR Review: [Filename] — [Date]",
  "verdict": "Approved|Changes Required|Rejected",
  "verdict_reason": "One sentence explaining the verdict",
  "executive_summary": "2-3 paragraph comprehensive review summary",
  "risk_assessment": {{
    "overall_risk": "Critical|High|Medium|Low|Minimal",
    "deployment_ready": true|false,
    "blocking_issues": ["List of issues that must be fixed before merge"]
  }},
  "findings_overview": {{
    "total": <int>,
    "critical": <int>,
    "high": <int>,
    "medium": <int>,
    "low": <int>,
    "info": <int>
  }},
  "key_issues": [
    {{
      "priority": 1,
      "issue": "Issue title",
      "impact": "Impact description",
      "action_required": "What the developer must do"
    }}
  ],
  "commendations": ["Things done well in this code"],
  "reviewer_notes": "Additional notes for the developer",
  "estimated_fix_time": "< 1 hour|1-4 hours|1 day|2-3 days|1 week+"
}}

Write in a professional but constructive tone. Return ONLY valid JSON."""


async def run_pr_summary(
    code: str,
    language: str,
    filename: str,
    code_analysis: dict,
    security_analysis: dict,
    remediation: dict,
) -> dict:
    """
    Run the PR Summary Agent using Gemini.
    Compiles all findings into a pull request review summary.
    """
    # Count all findings
    code_findings = code_analysis.get("findings", [])
    security_findings = security_analysis.get("vulnerabilities", [])

    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    all_findings = code_findings + security_findings
    for f in all_findings:
        sev = f.get("severity", "info").lower()
        if sev in severity_counts:
            severity_counts[sev] += 1

    prompt = PR_SUMMARY_PROMPT.format(
        language=language,
        filename=filename or "submitted_code",
        line_count=len(code.splitlines()),
        code_summary=code_analysis.get("summary", ""),
        security_summary=security_analysis.get("security_summary", ""),
        remediation_summary=remediation.get("remediation_summary", ""),
        total_findings=len(all_findings),
        critical=severity_counts["critical"],
        high=severity_counts["high"],
        medium=severity_counts["medium"],
        low=severity_counts["low"],
        info=severity_counts["info"],
    )

    try:
        response = _get_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=1024,
            ),
        )

        text = response.text.strip()
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

        result = json.loads(text)
        return result

    except json.JSONDecodeError as e:
        return {
            "pr_title": f"PR Review: {filename}",
            "verdict": "Changes Required",
            "verdict_reason": "Analysis completed but summary generation had issues.",
            "executive_summary": "Please review individual findings.",
            "risk_assessment": {"overall_risk": "Medium", "deployment_ready": False, "blocking_issues": []},
            "findings_overview": severity_counts,
            "key_issues": [],
            "commendations": [],
            "reviewer_notes": "Summary parsing error occurred.",
            "estimated_fix_time": "Unknown",
            "error": str(e),
        }
    except Exception as e:
        return {
            "pr_title": f"PR Review: {filename}",
            "verdict": "Changes Required",
            "verdict_reason": f"Analysis error: {str(e)}",
            "executive_summary": "",
            "risk_assessment": {"overall_risk": "Unknown", "deployment_ready": False, "blocking_issues": []},
            "findings_overview": severity_counts,
            "key_issues": [],
            "commendations": [],
            "reviewer_notes": "",
            "estimated_fix_time": "Unknown",
            "error": str(e),
        }
