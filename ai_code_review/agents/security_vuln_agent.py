"""
Security Vulnerability Agent
Milestone 2 — Task 2
Scans submitted code for OWASP-standard vulnerabilities.
Uses taint analysis (source → sink tracking) + Bandit + Gemini API.
Classifies by type and severity, provides location-specific flagging.
"""

import ast
import os
import json
import re
import subprocess
import tempfile
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


# ── Taint Analysis Configuration ──────────────────────────

TAINT_SOURCES = {
    # HTTP request inputs
    "request.GET", "request.POST", "request.args", "request.form",
    "request.json", "request.data", "request.params",
    "input(", "sys.argv",
}

TAINT_SINKS = {
    "sql": [
        "cursor.execute", "db.execute", "connection.execute",
        "session.execute", "engine.execute", "raw(",
    ],
    "xss": [
        "render_template_string", "Markup(", "innerHTML",
        "document.write", "dangerouslySetInnerHTML",
    ],
    "command": [
        "os.system", "subprocess.call", "subprocess.run",
        "subprocess.Popen", "eval(", "exec(",
    ],
    "path": [
        "open(", "os.path.join", "os.remove", "shutil.copy",
    ],
}

SANITIZERS = {
    "sql": [
        "%s", "?", ":param",           # parameterized query markers
        "sqlalchemy", "orm.",           # ORM usage
        "escape(", "quote(",
    ],
    "xss": [
        "html.escape", "escape(", "bleach.clean", "markupsafe",
        "| e", "| escape",              # Jinja2 auto-escape
    ],
    "command": [
        "shlex.quote", "shlex.split",
    ],
    "path": [
        "os.path.basename", "secure_filename", "abspath",
    ],
}

OWASP_SEVERITY = {
    "sql": "Critical",
    "xss": "High",
    "command": "Critical",
    "path": "High",
    "csrf": "High",
    "hardcoded_secret": "Critical",
    "insecure_auth": "High",
    "broken_access": "High",
}

OWASP_NAMES = {
    "sql": "SQL Injection (OWASP A03:2021)",
    "xss": "Cross-Site Scripting — XSS (OWASP A03:2021)",
    "command": "OS Command Injection (OWASP A03:2021)",
    "path": "Path Traversal (OWASP A01:2021)",
    "csrf": "Cross-Site Request Forgery — CSRF (OWASP A01:2021)",
    "hardcoded_secret": "Hardcoded Credentials (OWASP A07:2021)",
    "insecure_auth": "Insecure Authentication (OWASP A07:2021)",
    "broken_access": "Broken Access Control (OWASP A01:2021)",
}


class TaintTracker:
    """
    AST-based taint analysis engine.
    Tracks untrusted user input from sources through variable assignments
    to dangerous sinks, checking for sanitizers along the path.
    """

    def __init__(self, code: str):
        self.code = code
        self.tainted_vars: set = set()
        self.findings: list = []
        try:
            self.tree = ast.parse(code)
        except SyntaxError:
            self.tree = None

    def run(self) -> list:
        if self.tree is None:
            return []

        # Pass 1: identify taint sources
        self._identify_sources()

        # Pass 2: propagate taint through assignments
        self._propagate_taint()

        # Pass 3: check if tainted data reaches sinks without sanitizers
        self._check_sinks()

        return self.findings

    def _identify_sources(self):
        """Mark variables that receive untrusted user input."""
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Assign):
                # Check if the right-hand side is a taint source
                rhs_code = self._node_to_str(node.value)
                if self._is_taint_source(rhs_code):
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            self.tainted_vars.add(target.id)
                        elif isinstance(target, ast.Tuple):
                            for elt in target.elts:
                                if isinstance(elt, ast.Name):
                                    self.tainted_vars.add(elt.id)

            if isinstance(node, ast.AugAssign):
                rhs_code = self._node_to_str(node.value)
                if self._is_taint_source(rhs_code) and isinstance(
                    node.target, ast.Name
                ):
                    self.tainted_vars.add(node.target.id)

    def _propagate_taint(self):
        """
        Propagate taint when a tainted variable is assigned to another variable
        or used in string concatenation / f-string composition.
        """
        changed = True
        iterations = 0

        while changed and iterations < 10:
            changed = False
            iterations += 1

            for node in ast.walk(self.tree):
                if isinstance(node, ast.Assign):
                    rhs_code = self._node_to_str(node.value)
                    rhs_is_tainted = any(
                        var in rhs_code for var in self.tainted_vars
                    )

                    if rhs_is_tainted:
                        for target in node.targets:
                            if isinstance(target, ast.Name):
                                if target.id not in self.tainted_vars:
                                    self.tainted_vars.add(target.id)
                                    changed = True

    def _check_sinks(self):
        """
        For each dangerous sink call in the code,
        check whether any argument contains tainted data
        and whether a sanitizer was applied.
        """
        code_lines = self.code.splitlines()

        for node in ast.walk(self.tree):
            if not isinstance(node, ast.Call):
                continue

            call_str = self._node_to_str(node)

            for vuln_type, sinks in TAINT_SINKS.items():
                for sink in sinks:
                    if sink in call_str:
                        # Check if any argument is tainted
                        args_tainted = self._args_are_tainted(node)
                        if not args_tainted:
                            continue

                        # Check for sanitizer in the same call
                        sanitized = self._is_sanitized(call_str, vuln_type)
                        if sanitized:
                            continue

                        # Check context lines for sanitization
                        line_idx = (node.lineno or 1) - 1
                        context_start = max(0, line_idx - 5)
                        context = "\n".join(
                            code_lines[context_start: line_idx + 1]
                        )
                        if self._is_sanitized(context, vuln_type):
                            continue

                        self.findings.append({
                            "type": OWASP_NAMES[vuln_type],
                            "description": self._build_description(
                                vuln_type, sink, node.lineno
                            ),
                            "line": node.lineno,
                            "severity": OWASP_SEVERITY[vuln_type],
                            "category": "Security",
                            "owasp": OWASP_NAMES[vuln_type],
                            "sink": sink,
                        })

    def _args_are_tainted(self, call_node: ast.Call) -> bool:
        """Returns True if any argument of the call contains a tainted variable."""
        for arg in call_node.args:
            arg_str = self._node_to_str(arg)
            if any(var in arg_str for var in self.tainted_vars):
                return True
        for kw in call_node.keywords:
            kw_str = self._node_to_str(kw.value)
            if any(var in kw_str for var in self.tainted_vars):
                return True
        return False

    def _is_taint_source(self, code_fragment: str) -> bool:
        return any(src in code_fragment for src in TAINT_SOURCES)

    def _is_sanitized(self, code_fragment: str, vuln_type: str) -> bool:
        sanitizer_list = SANITIZERS.get(vuln_type, [])
        return any(san in code_fragment for san in sanitizer_list)

    def _node_to_str(self, node) -> str:
        try:
            return ast.unparse(node)
        except Exception:
            return ""

    def _build_description(self, vuln_type: str, sink: str, line: int) -> str:
        descriptions = {
            "sql": (
                f"Tainted user input reaches SQL sink '{sink}' at line {line} "
                "without parameterization. An attacker can manipulate the query "
                "to read, modify, or delete database records. "
                "Fix: Use parameterized queries — cursor.execute(query, (param,))"
            ),
            "xss": (
                f"Unescaped user input rendered in HTML via '{sink}' at line {line}. "
                "An attacker can inject malicious scripts into the page. "
                "Fix: Use html.escape() or enable template auto-escaping."
            ),
            "command": (
                f"Tainted input passed to OS command sink '{sink}' at line {line}. "
                "An attacker can execute arbitrary system commands. "
                "Fix: Avoid shell=True, use shlex.quote() and pass args as a list."
            ),
            "path": (
                f"User-controlled path passed to '{sink}' at line {line}. "
                "An attacker can traverse the filesystem to read sensitive files. "
                "Fix: Use os.path.basename() and validate against an allowed directory."
            ),
        }
        return descriptions.get(
            vuln_type,
            f"Security vulnerability detected near '{sink}' at line {line}."
        )


class SecurityVulnAgent:
    """
    Security Vulnerability Agent.
    Combines:
    1. Taint analysis (source → sink tracking)
    2. Bandit static scanner (Python only)
    3. Gemini API (pattern-level OWASP detection)
    """

    def __init__(self):
        pass  # client is created lazily via _get_client()

    def analyze(self, submission: dict) -> dict:
        code = submission["code"]
        language = submission["language"]
        findings = []

        # Layer 1: Taint analysis (Python)
        if language == "python":
            tracker = TaintTracker(code)
            taint_findings = tracker.run()
            findings += taint_findings

        # Layer 2: Bandit (Python only)
        if language == "python":
            bandit_findings = self._run_bandit(code)
            findings += bandit_findings

        # Layer 3: Regex-based pattern scan (all languages)
        findings += self._pattern_scan(code, language)

        # Layer 4: Gemini API for semantic detection
        gemini_findings = self._gemini_security_analysis(code, language)
        findings += gemini_findings

        # Deduplicate and sort
        findings = self._deduplicate(findings)
        findings = sorted(
            findings,
            key=lambda f: ["Critical", "High", "Medium", "Low"].index(
                f.get("severity", "Low")
            ),
        )

        return {
            "agent": "Security Vulnerability Agent",
            "language": language,
            "total_findings": len(findings),
            "findings": findings,
        }

    def _run_bandit(self, code: str) -> list:
        """Runs Bandit static analysis on Python code via subprocess."""
        findings = []
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".py", delete=False, encoding="utf-8"
            ) as tmp:
                tmp.write(code)
                tmp_path = tmp.name

            result = subprocess.run(
                ["bandit", "-f", "json", "-q", tmp_path],
                capture_output=True,
                text=True,
                timeout=30,
            )

            output = result.stdout.strip()
            if output:
                data = json.loads(output)
                for issue in data.get("results", []):
                    severity_map = {
                        "HIGH": "High",
                        "MEDIUM": "Medium",
                        "LOW": "Low",
                    }
                    findings.append({
                        "type": issue.get("test_name", "Bandit Finding"),
                        "description": issue.get("issue_text", ""),
                        "line": issue.get("line_number", 0),
                        "severity": severity_map.get(
                            issue.get("issue_severity", "LOW"), "Low"
                        ),
                        "category": "Security",
                        "source": "Bandit",
                    })

            try:
                os.unlink(tmp_path)
            except Exception:
                pass

        except FileNotFoundError:
            print("[SecurityAgent] Bandit not installed — skipping Bandit scan.")
        except Exception as e:
            print(f"[SecurityAgent] Bandit error: {e}")

        return findings

    def _pattern_scan(self, code: str, language: str) -> list:
        """
        Regex-based scan for CSRF missing protection, hardcoded secrets,
        and insecure configurations. Works for Python and Java.
        """
        findings = []
        lines = code.splitlines()

        secret_patterns = [
            (
                r'(?i)(password|passwd|secret|api_key|token|auth_key)\s*=\s*["\'][^"\']{4,}["\']',
                "Hardcoded Credentials (OWASP A07:2021)", "Critical"
            ),
            (
                r'(?i)DEBUG\s*=\s*True',
                "Debug Mode Enabled in Production", "High"
            ),
            (
                r'(?i)ALLOWED_HOSTS\s*=\s*\[.*\*.*\]',
                "Insecure ALLOWED_HOSTS Wildcard", "High"
            ),
            (
                r'(?i)verify\s*=\s*False',
                "SSL Certificate Verification Disabled", "High"
            ),
        ]

        for i, line in enumerate(lines, start=1):
            for pattern, vuln_name, severity in secret_patterns:
                if re.search(pattern, line):
                    findings.append({
                        "type": vuln_name,
                        "description": (
                            f"Potential security misconfiguration detected at line {i}: "
                            f"'{line.strip()}'. Review and move sensitive values to "
                            "environment variables."
                        ),
                        "line": i,
                        "severity": severity,
                        "category": "Security",
                        "source": "Pattern Scan",
                    })

        # CSRF check for Django/Flask views (no @csrf_exempt but POST handlers)
        if language == "python":
            has_post_handler = bool(re.search(r"request\.POST|request\.form", code))
            has_csrf_protection = bool(
                re.search(r"csrf_token|CsrfViewMiddleware|@csrf_protect", code)
            )
            if has_post_handler and not has_csrf_protection:
                findings.append({
                    "type": "Missing CSRF Protection (OWASP A01:2021)",
                    "description": (
                        "POST request handler detected without explicit CSRF protection. "
                        "Ensure Django's CsrfViewMiddleware is enabled or use "
                        "@csrf_protect on view functions."
                    ),
                    "line": 0,
                    "severity": "High",
                    "category": "Security",
                    "source": "Pattern Scan",
                })

        return findings

    def _gemini_security_analysis(self, code: str, language: str) -> list:
        """
        Uses Gemini to detect semantic-level OWASP vulnerabilities
        that static analysis may miss.
        """
        prompt = f"""You are a security engineer specializing in OWASP vulnerability assessment.

Analyze the following {language} code for security vulnerabilities including:
- SQL Injection (OWASP A03:2021)
- Cross-Site Scripting / XSS (OWASP A03:2021)
- Broken Access Control (OWASP A01:2021)
- Insecure Authentication / weak password checks (OWASP A07:2021)
- Security Misconfiguration (OWASP A05:2021)
- Insecure Deserialization
- Missing input validation

Return ONLY a JSON array. Each item must have:
- "type": OWASP vulnerability name
- "description": what the issue is and the exact fix
- "line": integer line number (0 if general)
- "severity": "Critical", "High", "Medium", or "Low"
- "category": "Security"

If no vulnerabilities found, return: []
Return raw JSON only — no markdown, no explanation.

CODE:
```{language}
{code[:3000]}
```"""

        try:
            response = _get_client().models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            text = response.text.strip()
            text = re.sub(r"```(?:json)?\n?", "", text).strip()
            text = re.sub(r"\n?```$", "", text).strip()
            data = json.loads(text)
            if isinstance(data, list):
                valid = []
                for item in data:
                    if all(k in item for k in ("type", "description", "severity")):
                        item.setdefault("line", 0)
                        item.setdefault("category", "Security")
                        item.setdefault("source", "Gemini")
                        valid.append(item)
                return valid
        except Exception as e:
            print(f"[SecurityAgent] Gemini error: {e}")

        return []

    def _deduplicate(self, findings: list) -> list:
        seen = set()
        unique = []
        for f in findings:
            key = (f.get("type", "")[:40], f.get("line", 0))
            if key not in seen:
                seen.add(key)
                unique.append(f)
        return unique
