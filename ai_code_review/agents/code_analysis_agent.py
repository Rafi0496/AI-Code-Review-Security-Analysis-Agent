"""
Code Analysis Agent
Milestone 2 — Task 1
Detects code smells, complexity issues, design anti-patterns,
and poor coding practices with severity scoring per finding.
Powered by Google Gemini API + AST + Radon.
"""

import ast
import os
import json
import re
import google.generativeai as genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client

GEMINI_MODEL = "gemini-2.0-flash"

# Severity thresholds
COMPLEXITY_THRESHOLDS = {
    "Critical": 20,
    "High": 15,
    "Medium": 10,
    "Low": 5,
}

MAX_FUNCTION_LINES = 50
MAX_PARAMETERS = 5
MAX_NESTING_DEPTH = 4


class CodeAnalysisAgent:
    """
    Analyzes submitted code for quality issues using:
    1. Static analysis — AST walking, Radon complexity metrics
    2. Gemini API — deep pattern analysis and anti-pattern detection
    Each finding includes: type, description, line number, severity.
    """

    def __init__(self):
        pass  # client is created lazily via _get_client()

    def analyze(self, submission: dict) -> dict:
        """
        Main entry point. Accepts a submission payload from CodeSubmission.
        Returns a structured list of findings.
        """
        code = submission["code"]
        language = submission["language"]
        findings = []

        if language == "python":
            findings += self._static_analysis_python(code)

        findings += self._gemini_analysis(code, language)

        findings = self._deduplicate(findings)
        findings = sorted(
            findings,
            key=lambda f: ["Critical", "High", "Medium", "Low"].index(
                f.get("severity", "Low")
            )
        )

        return {
            "agent": "Code Analysis Agent",
            "language": language,
            "total_findings": len(findings),
            "findings": findings,
        }

    # ──────────────────────────────────────────────────
    # STATIC ANALYSIS (Python)
    # ──────────────────────────────────────────────────

    def _static_analysis_python(self, code: str) -> list:
        """
        Runs AST-based static checks on Python code:
        - Cyclomatic complexity via Radon
        - Long functions
        - Too many parameters
        - Deeply nested code
        - Missing docstrings
        - Bare except clauses
        - Hardcoded passwords/secrets
        """
        findings = []

        try:
            tree = ast.parse(code)
        except SyntaxError:
            return findings

        # 1. Cyclomatic Complexity (Radon)
        try:
            from radon.complexity import cc_visit
            cc_results = cc_visit(code)
            for block in cc_results:
                if block.complexity >= COMPLEXITY_THRESHOLDS["Medium"]:
                    severity = self._complexity_severity(block.complexity)
                    findings.append({
                        "type": "High Cyclomatic Complexity",
                        "description": (
                            f"Function '{block.name}' has a cyclomatic complexity of "
                            f"{block.complexity}. Functions with complexity above 10 are "
                            "difficult to test and maintain."
                        ),
                        "line": block.lineno,
                        "severity": severity,
                        "category": "Complexity",
                    })
        except Exception:
            pass

        # 2. Walk AST for code smells
        for node in ast.walk(tree):

            # Long functions
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func_lines = (node.end_lineno or node.lineno) - node.lineno
                if func_lines > MAX_FUNCTION_LINES:
                    findings.append({
                        "type": "God Function",
                        "description": (
                            f"Function '{node.name}' is {func_lines} lines long "
                            f"(threshold: {MAX_FUNCTION_LINES}). "
                            "Consider breaking it into smaller, focused functions."
                        ),
                        "line": node.lineno,
                        "severity": "High" if func_lines > 80 else "Medium",
                        "category": "Code Smell",
                    })

                # Too many parameters
                param_count = len(node.args.args)
                if param_count > MAX_PARAMETERS:
                    findings.append({
                        "type": "Too Many Parameters",
                        "description": (
                            f"Function '{node.name}' has {param_count} parameters "
                            f"(threshold: {MAX_PARAMETERS}). "
                            "Consider using a data class or configuration object."
                        ),
                        "line": node.lineno,
                        "severity": "Medium",
                        "category": "Code Smell",
                    })

                # Missing docstring
                if not (
                    node.body
                    and isinstance(node.body[0], ast.Expr)
                    and isinstance(node.body[0].value, ast.Constant)
                    and isinstance(node.body[0].value.value, str)
                ):
                    findings.append({
                        "type": "Missing Docstring",
                        "description": (
                            f"Function '{node.name}' has no docstring. "
                            "Add a docstring describing the function's purpose, "
                            "parameters, and return value."
                        ),
                        "line": node.lineno,
                        "severity": "Low",
                        "category": "Documentation",
                    })

            # Bare except
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                findings.append({
                    "type": "Bare Except Clause",
                    "description": (
                        "Bare 'except:' catches all exceptions including SystemExit "
                        "and KeyboardInterrupt. Use 'except Exception as e:' instead."
                    ),
                    "line": node.lineno,
                    "severity": "Medium",
                    "category": "Error Handling",
                })

            # Hardcoded secrets / passwords
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        var_name = target.id.lower()
                        secret_keywords = [
                            "password", "passwd", "secret", "api_key",
                            "token", "credential", "auth_key",
                        ]
                        if any(kw in var_name for kw in secret_keywords):
                            if isinstance(node.value, ast.Constant) and isinstance(
                                node.value.value, str
                            ):
                                findings.append({
                                    "type": "Hardcoded Secret",
                                    "description": (
                                        f"Variable '{target.id}' appears to contain a "
                                        "hardcoded credential. Use environment variables "
                                        "or a secrets manager instead."
                                    ),
                                    "line": node.lineno,
                                    "severity": "Critical",
                                    "category": "Security",
                                })

        # 3. Nesting depth
        nesting_findings = self._check_nesting_depth(tree)
        findings += nesting_findings

        return findings

    def _check_nesting_depth(self, tree: ast.AST) -> list:
        """Walks the AST to find deeply nested control flow."""
        findings = []

        class NestingVisitor(ast.NodeVisitor):
            def __init__(self):
                self.depth = 0
                self.deep_nodes = []

            def visit_control(self, node):
                self.depth += 1
                if self.depth > MAX_NESTING_DEPTH:
                    self.deep_nodes.append((node.lineno, self.depth))
                self.generic_visit(node)
                self.depth -= 1

            visit_If = visit_control
            visit_For = visit_control
            visit_While = visit_control
            visit_With = visit_control
            visit_Try = visit_control

        visitor = NestingVisitor()
        visitor.visit(tree)

        seen_lines = set()
        for lineno, depth in visitor.deep_nodes:
            if lineno not in seen_lines:
                findings.append({
                    "type": "Excessive Nesting Depth",
                    "description": (
                        f"Nesting depth of {depth} detected at line {lineno} "
                        f"(threshold: {MAX_NESTING_DEPTH}). "
                        "Refactor using early returns or helper functions."
                    ),
                    "line": lineno,
                    "severity": "Medium",
                    "category": "Complexity",
                })
                seen_lines.add(lineno)

        return findings

    def _complexity_severity(self, complexity: int) -> str:
        if complexity >= COMPLEXITY_THRESHOLDS["Critical"]:
            return "Critical"
        elif complexity >= COMPLEXITY_THRESHOLDS["High"]:
            return "High"
        elif complexity >= COMPLEXITY_THRESHOLDS["Medium"]:
            return "Medium"
        return "Low"

    # ──────────────────────────────────────────────────
    # GEMINI API ANALYSIS
    # ──────────────────────────────────────────────────

    def _gemini_analysis(self, code: str, language: str) -> list:
        """
        Sends chunked code to Gemini API for deep pattern analysis.
        Detects anti-patterns, design issues, and poor practices
        that static analysis alone may miss.
        """
        chunks = self._chunk_by_function(code, language)
        all_findings = []

        for chunk in chunks:
            prompt = self._build_analysis_prompt(chunk, language)
            try:
                response = _get_client().models.generate_content(
                    model=GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                parsed = self._parse_gemini_response(response.text)
                all_findings += parsed
            except Exception as e:
                print(f"[CodeAnalysisAgent] Gemini API error: {e}")

        return all_findings

    def _build_analysis_prompt(self, code_chunk: str, language: str) -> str:
        return f"""You are a senior software engineer performing a code quality review.

Analyze the following {language} code for:
- Design anti-patterns (God Class, Singleton misuse, Magic Numbers, Feature Envy)
- Poor practices (mutable default arguments, global variables, print debugging)
- Maintainability issues (unclear naming, dead code, duplicate logic)

Return ONLY a JSON array of findings. Each finding must have:
- "type": short name of the issue
- "description": clear explanation of the problem and how to fix it
- "line": integer line number where issue is found (use 0 if not line-specific)
- "severity": one of "Critical", "High", "Medium", "Low"
- "category": one of "Design", "Maintainability", "Practice", "Naming"

If no issues found, return an empty array: []

Do not include markdown code fences. Return raw JSON only.

CODE TO REVIEW:
```{language}
{code_chunk}
```"""

    def _parse_gemini_response(self, response_text: str) -> list:
        """Safely parses Gemini's JSON response into a list of findings."""
        text = response_text.strip()
        # Strip markdown code fences if present
        text = re.sub(r"```(?:json)?\n?", "", text).strip()
        text = re.sub(r"\n?```$", "", text).strip()

        try:
            data = json.loads(text)
            if isinstance(data, list):
                valid = []
                for item in data:
                    if all(k in item for k in ("type", "description", "severity")):
                        item.setdefault("line", 0)
                        item.setdefault("category", "General")
                        valid.append(item)
                return valid
        except json.JSONDecodeError:
            pass

        return []

    def _chunk_by_function(self, code: str, language: str) -> list:
        """
        Splits code into function/class-level chunks for Gemini.
        Prevents exceeding context limits while keeping logical units intact.
        """
        if language != "python":
            # For Java, split at class-level blocks (simple approach)
            return [code[:4000]] if len(code) > 4000 else [code]

        try:
            tree = ast.parse(code)
        except SyntaxError:
            return [code[:4000]]

        lines = code.splitlines()
        chunks = []

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                start = node.lineno - 1
                end = node.end_lineno or (start + 50)
                chunk = "\n".join(lines[start:end])
                if chunk.strip():
                    chunks.append(chunk)

        # If no functions found, send the whole file (up to 4000 chars)
        if not chunks:
            chunks = [code[:4000]]

        return chunks

    def _deduplicate(self, findings: list) -> list:
        """Removes duplicate findings based on type + line number."""
        seen = set()
        unique = []
        for f in findings:
            key = (f.get("type", ""), f.get("line", 0))
            if key not in seen:
                seen.add(key)
                unique.append(f)
        return unique
