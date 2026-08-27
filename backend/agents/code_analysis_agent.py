"""
Code Analysis Agent — Reviews code structure, identifies code smells,
design anti-patterns, complexity issues, and poor practices using Google ADK + Gemini.
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

CODE_ANALYSIS_PROMPT = """You are an expert software engineer and code quality analyst.
Analyze the provided source code thoroughly for:

1. **Code Smells**: Duplicate code, long methods, large classes, dead code, magic numbers, poor naming
2. **Design Anti-Patterns**: God classes, tight coupling, poor cohesion, violation of SOLID principles
3. **Complexity Issues**: High cyclomatic complexity, deeply nested conditions, complex expressions
4. **Documentation Deficiencies**: Missing docstrings, unclear comments, unexplained logic
5. **Best Practice Violations**: Non-idiomatic code, inconsistent style, missing error handling
6. **Maintainability Issues**: Hard-to-test code, poor separation of concerns

Language: {language}

Source Code:
```{language}
{code}
```

Return your analysis as a JSON object with this exact structure:
{{
  "summary": "Brief overall assessment (2-3 sentences)",
  "quality_score": <integer 0-100>,
  "maintainability_rating": "Excellent|Good|Fair|Poor",
  "findings": [
    {{
      "severity": "high|medium|low|info",
      "category": "Code Smell|Design Issue|Complexity|Documentation|Best Practice",
      "title": "Short issue title",
      "description": "Detailed description of the issue",
      "line_number": <integer or null>,
      "recommendation": "How to fix this issue"
    }}
  ],
  "positive_aspects": ["List of good things in the code"],
  "top_recommendations": ["Top 3 actionable improvements"]
}}

Be specific, actionable, and educational. Return ONLY valid JSON."""


async def run_code_analysis(code: str, language: str) -> dict:
    """
    Run the Code Analysis Agent using Gemini.
    Returns structured JSON findings.
    """
    prompt = CODE_ANALYSIS_PROMPT.format(language=language, code=code)

    try:
        response = _get_client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=1024,
            ),
        )

        text = response.text.strip()
        # Strip markdown code blocks if present
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

        result = json.loads(text)
        return result

    except json.JSONDecodeError as e:
        return {
            "summary": "Code analysis completed with parsing issues.",
            "quality_score": 50,
            "maintainability_rating": "Fair",
            "findings": [],
            "positive_aspects": [],
            "top_recommendations": ["Review code manually for quality issues."],
            "error": str(e),
        }
    except Exception as e:
        return {
            "summary": f"Code analysis encountered an error: {str(e)}",
            "quality_score": 0,
            "maintainability_rating": "Poor",
            "findings": [],
            "positive_aspects": [],
            "top_recommendations": [],
            "error": str(e),
        }
