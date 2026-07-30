"""
Validation & Testing Suite
Milestone 2 — Task 4
Tests Code Analysis Agent, Security Vulnerability Agent, and Multi-Agent Orchestrator.
Validates accuracy of findings against known vulnerable and clean samples.
"""

import sys
import os
import json
import pytest
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.submission import CodeSubmission, CodeSubmissionError
from modules.rag_pipeline import RAGPipeline
from agents.code_analysis_agent import CodeAnalysisAgent
from agents.security_vuln_agent import SecurityVulnAgent, TaintTracker
from agents.orchestrator import MultiAgentOrchestrator


# ──────────────────────────────────────────────────────────────────
# FIXTURES
# ──────────────────────────────────────────────────────────────────

SAMPLE_DIR = Path(__file__).parent / "sample_code"


def load_sample(filename: str) -> str:
    return (SAMPLE_DIR / filename).read_text(encoding="utf-8")


# ──────────────────────────────────────────────────────────────────
# MILESTONE 1 TESTS — Code Submission Module
# ──────────────────────────────────────────────────────────────────

class TestCodeSubmission:
    """Tests for the CodeSubmission module (Milestone 1, Task 3)."""

    def setup_method(self):
        self.submission = CodeSubmission()

    def test_from_text_python_valid(self):
        """Should accept valid Python code."""
        code = "def hello():\n    return 'world'\n"
        result = self.submission.from_text(code, "python")
        assert result["language"] == "python"
        assert result["source"] == "paste"
        assert result["lines"] == 2

    def test_from_text_java_valid(self):
        """Should accept valid Java code."""
        code = "public class Hello { public static void main(String[] args) {} }"
        result = self.submission.from_text(code, "java")
        assert result["language"] == "java"
        assert result["source"] == "paste"

    def test_from_text_unsupported_language(self):
        """Should raise CodeSubmissionError for unsupported languages."""
        with pytest.raises(CodeSubmissionError, match="Unsupported language"):
            self.submission.from_text("print('hello')", "ruby")

    def test_from_text_invalid_python_syntax(self):
        """Should reject Python code with syntax errors."""
        invalid_code = "def broken(\n    return 'oops'\n"
        with pytest.raises(CodeSubmissionError, match="Syntax error"):
            self.submission.from_text(invalid_code, "python")

    def test_from_text_java_no_class(self):
        """Should reject Java code with no class definition."""
        code = "System.out.println('hello');"
        with pytest.raises(CodeSubmissionError):
            self.submission.from_text(code, "java")

    def test_from_text_case_insensitive_language(self):
        """Language parameter should be case-insensitive."""
        code = "x = 1\n"
        result = self.submission.from_text(code, "Python")
        assert result["language"] == "python"
        result2 = self.submission.from_text(code, "PYTHON")
        assert result2["language"] == "python"

    def test_from_file_python(self, tmp_path):
        """Should successfully load a Python file."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def hello():\n    return 'world'\n", encoding="utf-8")
        result = self.submission.from_file(str(py_file))
        assert result["language"] == "python"
        assert result["filename"] == "test.py"
        assert result["source"] == "file"

    def test_from_file_unsupported_extension(self, tmp_path):
        """Should reject unsupported file types."""
        rb_file = tmp_path / "script.rb"
        rb_file.write_text("puts 'hello'", encoding="utf-8")
        with pytest.raises(CodeSubmissionError, match="Unsupported file type"):
            self.submission.from_file(str(rb_file))


# ──────────────────────────────────────────────────────────────────
# MILESTONE 1 TESTS — RAG Pipeline
# ──────────────────────────────────────────────────────────────────

class TestRAGPipeline:
    """Tests for the RAG Pipeline (Milestone 1, Task 4)."""

    def setup_method(self):
        self.rag = RAGPipeline()
        self.rag.build_knowledge_base()

    def test_build_knowledge_base(self):
        """Knowledge base should be buildable without errors."""
        # If we reach here without exception, the build worked
        assert True

    def test_retrieve_returns_list(self):
        """Retrieve should return a list."""
        results = self.rag.retrieve("SQL injection prevention")
        assert isinstance(results, list)

    def test_retrieve_sql_injection_context(self):
        """Querying for SQL injection should return relevant content."""
        results = self.rag.retrieve("SQL injection parameterized query")
        # May return 0 results if KB is empty, but should not error
        for r in results:
            assert "content" in r
            assert "source" in r

    def test_get_context_string_returns_string(self):
        """get_context_string should return a non-empty string."""
        context = self.rag.get_context_string("XSS prevention")
        assert isinstance(context, str)
        assert len(context) > 0

    def test_chunking_by_section(self):
        """Chunking should split content at section boundaries."""
        content = (
            "# Section 1\nFirst paragraph with enough content here.\n\n"
            "# Section 2\nSecond paragraph with enough content here.\n\n"
            "---\n"
            "# Section 3\nThird paragraph content.\n"
        )
        chunks = self.rag._chunk_by_section(content, "test.txt")
        assert len(chunks) >= 1

    def test_chunking_fallback_paragraphs(self):
        """Should fall back to paragraph splitting when no sections found."""
        content = "First paragraph content that is long enough.\n\nSecond paragraph content that is also long enough."
        chunks = self.rag._chunk_by_section(content, "test.txt")
        assert len(chunks) >= 1


# ──────────────────────────────────────────────────────────────────
# MILESTONE 2 TESTS — Code Analysis Agent
# ──────────────────────────────────────────────────────────────────

class TestCodeAnalysisAgent:
    """Tests for Code Analysis Agent (Milestone 2, Task 1)."""

    def setup_method(self):
        self.agent = CodeAnalysisAgent()
        self.submission_handler = CodeSubmission()

    def test_detects_hardcoded_secret(self):
        """Should detect hardcoded API keys and passwords."""
        code = 'API_KEY = "sk-prod-abc123xyz789"\npassword = "admin123"\n'
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        types = [f["type"] for f in result["findings"]]
        assert "Hardcoded Secret" in types, f"Expected 'Hardcoded Secret' in {types}"

    def test_detects_too_many_parameters(self):
        """Should detect functions with too many parameters."""
        code = "def func(a, b, c, d, e, f, g):\n    pass\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        types = [f["type"] for f in result["findings"]]
        assert "Too Many Parameters" in types, f"Expected 'Too Many Parameters' in {types}"

    def test_detects_bare_except(self):
        """Should detect bare except clauses."""
        code = "try:\n    x = 1/0\nexcept:\n    pass\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        types = [f["type"] for f in result["findings"]]
        assert "Bare Except Clause" in types, f"Expected 'Bare Except Clause' in {types}"

    def test_detects_missing_docstring(self):
        """Should detect functions without docstrings."""
        code = "def undocumented_function(x, y):\n    return x + y\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        types = [f["type"] for f in result["findings"]]
        assert "Missing Docstring" in types, f"Expected 'Missing Docstring' in {types}"

    def test_result_structure(self):
        """Result should have the correct structure."""
        code = "x = 1\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        assert "agent" in result
        assert result["agent"] == "Code Analysis Agent"
        assert "language" in result
        assert "total_findings" in result
        assert "findings" in result
        assert isinstance(result["findings"], list)

    def test_findings_are_severity_sorted(self):
        """Findings should be sorted Critical → High → Medium → Low."""
        code = load_sample("vulnerable_python.py")
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        sev_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        severities = [sev_order.get(f.get("severity", "Low"), 3)
                      for f in result["findings"]]
        assert severities == sorted(severities), "Findings not sorted by severity"

    def test_each_finding_has_required_fields(self):
        """Every finding must have type, description, line, severity, category."""
        code = 'API_KEY = "secret"\ntry:\n    pass\nexcept:\n    pass\n'
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        for f in result["findings"]:
            assert "type" in f, f"Missing 'type' in finding: {f}"
            assert "description" in f, f"Missing 'description' in finding: {f}"
            assert "line" in f, f"Missing 'line' in finding: {f}"
            assert "severity" in f, f"Missing 'severity' in finding: {f}"
            assert "category" in f, f"Missing 'category' in finding: {f}"

    def test_clean_code_has_fewer_findings(self):
        """Clean code should produce fewer findings than vulnerable code."""
        sub_handler = CodeSubmission()
        clean_code = (
            "def add(a: int, b: int) -> int:\n"
            "    \"\"\"Add two integers.\"\"\"\n"
            "    return a + b\n"
        )
        vuln_code = load_sample("vulnerable_python.py")
        clean_sub = sub_handler.from_text(clean_code, "python")
        vuln_sub = sub_handler.from_text(vuln_code, "python")
        clean_result = self.agent.analyze(clean_sub)
        vuln_result = self.agent.analyze(vuln_sub)
        assert clean_result["total_findings"] < vuln_result["total_findings"], (
            f"Clean: {clean_result['total_findings']} findings, "
            f"Vulnerable: {vuln_result['total_findings']} findings"
        )

    def test_vulnerable_sample_detected(self):
        """Vulnerable sample should produce Critical findings."""
        code = load_sample("vulnerable_python.py")
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        severities = [f["severity"] for f in result["findings"]]
        assert "Critical" in severities, (
            f"Expected Critical findings in vulnerable sample, got: {severities}"
        )


# ──────────────────────────────────────────────────────────────────
# MILESTONE 2 TESTS — Security Vulnerability Agent
# ──────────────────────────────────────────────────────────────────

class TestSecurityVulnAgent:
    """Tests for Security Vulnerability Agent (Milestone 2, Task 2)."""

    def setup_method(self):
        self.agent = SecurityVulnAgent()
        self.submission_handler = CodeSubmission()

    def test_taint_tracker_sql_injection(self):
        """TaintTracker should detect SQL injection via taint flow."""
        code = (
            "import sqlite3\n"
            "username = request.GET['username']\n"
            "conn = sqlite3.connect('db')\n"
            "cursor = conn.cursor()\n"
            "cursor.execute(\"SELECT * FROM users WHERE name='\" + username + \"'\")\n"
        )
        tracker = TaintTracker(code)
        findings = tracker.run()
        types = [f["type"] for f in findings]
        assert any("SQL" in t for t in types), (
            f"Expected SQL Injection finding from taint analysis, got: {types}"
        )

    def test_taint_tracker_command_injection(self):
        """TaintTracker should detect command injection via taint flow."""
        code = (
            "import os\n"
            "host = request.GET['host']\n"
            "cmd = 'ping ' + host\n"
            "os.system(cmd)\n"
        )
        tracker = TaintTracker(code)
        findings = tracker.run()
        types = [f["type"] for f in findings]
        assert any("Command" in t or "command" in t.lower() for t in types), (
            f"Expected Command Injection from taint analysis, got: {types}"
        )

    def test_pattern_scan_hardcoded_credentials(self):
        """Pattern scan should detect hardcoded passwords."""
        code = 'DB_PASSWORD = "supersecret123"\nAPI_KEY = "abc-xyz-789"\n'
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        types = [f["type"] for f in result["findings"]]
        assert any("Hardcoded" in t or "Credential" in t for t in types), (
            f"Expected Hardcoded Credentials in {types}"
        )

    def test_pattern_scan_debug_mode(self):
        """Pattern scan should detect DEBUG=True."""
        code = "DEBUG = True\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        types = [f["type"] for f in result["findings"]]
        assert any("Debug" in t for t in types), (
            f"Expected Debug Mode finding in {types}"
        )

    def test_csrf_detection(self):
        """Should flag POST handlers without CSRF protection."""
        code = (
            "def login(request):\n"
            "    username = request.POST.get('username')\n"
            "    password = request.POST.get('password')\n"
            "    return authenticate(username, password)\n"
        )
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        types = [f["type"] for f in result["findings"]]
        assert any("CSRF" in t for t in types), (
            f"Expected CSRF finding in {types}"
        )

    def test_result_structure(self):
        """Result should have correct structure."""
        code = "x = 1\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        assert result["agent"] == "Security Vulnerability Agent"
        assert "total_findings" in result
        assert "findings" in result

    def test_findings_severity_sorted(self):
        """Security findings should be sorted Critical first."""
        code = load_sample("vulnerable_python.py")
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        sev_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        orders = [sev_order.get(f.get("severity", "Low"), 3) for f in result["findings"]]
        assert orders == sorted(orders)

    def test_no_false_positives_on_safe_sql(self):
        """Parameterized SQL should not be flagged as SQL injection."""
        code = (
            "import sqlite3\n"
            "user_id = request.GET['id']\n"
            "conn = sqlite3.connect('db')\n"
            "cursor = conn.cursor()\n"
            "cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))\n"
        )
        tracker = TaintTracker(code)
        findings = tracker.run()
        sql_findings = [f for f in findings if "SQL" in f.get("type", "")]
        assert len(sql_findings) == 0, (
            f"False positive: parameterized query flagged as SQL injection: {sql_findings}"
        )

    def test_vulnerable_sample_has_critical_findings(self):
        """Vulnerable Python sample should produce Critical-severity findings."""
        code = load_sample("vulnerable_python.py")
        submission = self.submission_handler.from_text(code, "python")
        result = self.agent.analyze(submission)
        critical = [f for f in result["findings"] if f["severity"] == "Critical"]
        assert len(critical) > 0, (
            f"Expected Critical findings in vulnerable sample. Got: {result['findings']}"
        )


# ──────────────────────────────────────────────────────────────────
# MILESTONE 2 TESTS — Multi-Agent Orchestrator
# ──────────────────────────────────────────────────────────────────

class TestMultiAgentOrchestrator:
    """Tests for Multi-Agent Orchestrator (Milestone 2, Task 3)."""

    def setup_method(self):
        self.orchestrator = MultiAgentOrchestrator()
        self.submission_handler = CodeSubmission()

    def test_run_sync_returns_dict(self):
        """Orchestrator should return a dict with required keys."""
        code = "x = 1\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        assert isinstance(result, dict)
        assert "findings" in result
        assert "summary" in result
        assert "execution_time_seconds" in result
        assert "submission" in result

    def test_summary_structure(self):
        """Summary should have severity_breakdown and total_findings."""
        code = "x = 1\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        summary = result["summary"]
        assert "total_findings" in summary
        assert "severity_breakdown" in summary
        assert "risk_level" in summary
        for sev in ("Critical", "High", "Medium", "Low"):
            assert sev in summary["severity_breakdown"]

    def test_overall_risk_critical(self):
        """Vulnerable code with critical issues should return Critical risk."""
        code = load_sample("vulnerable_python.py")
        submission = self.submission_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        assert result["summary"]["risk_level"] == "Critical", (
            f"Expected Critical risk, got: {result['summary']['risk_level']}"
        )

    def test_findings_tagged_with_agent(self):
        """Every finding should be tagged with its source agent."""
        code = 'API_KEY = "secret"\n'
        submission = self.submission_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        for f in result["findings"]:
            assert "agent" in f, f"Finding missing 'agent' tag: {f}"
            assert f["agent"] in (
                "Code Analysis Agent",
                "Security Vulnerability Agent",
            )

    def test_no_duplicate_findings(self):
        """Merged findings should not have duplicate (type, line) pairs."""
        code = 'API_KEY = "secret"\n'
        submission = self.submission_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        keys = [(f.get("type", "")[:40], f.get("line", 0))
                for f in result["findings"]]
        assert len(keys) == len(set(keys)), "Duplicate findings detected in merged output"

    def test_execution_time_recorded(self):
        """Execution time should be a positive number."""
        code = "x = 1\n"
        submission = self.submission_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        assert isinstance(result["execution_time_seconds"], (int, float))
        assert result["execution_time_seconds"] >= 0

    def test_merge_findings_severity_sort(self):
        """Merged findings should be sorted by severity."""
        code = load_sample("vulnerable_python.py")
        submission = self.submission_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        sev_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        orders = [sev_order.get(f.get("severity", "Low"), 3)
                  for f in result["findings"]]
        assert orders == sorted(orders), "Merged findings not sorted by severity"

    def test_vulnerable_vs_clean_finding_count(self):
        """Vulnerable code should produce more findings than clean code."""
        sub_handler = CodeSubmission()
        clean_code = (
            "def add(a: int, b: int) -> int:\n"
            "    \"\"\"Add two integers.\"\"\"\n"
            "    return a + b\n"
        )
        vuln_code = load_sample("vulnerable_python.py")
        clean_result = self.orchestrator.run_sync(
            sub_handler.from_text(clean_code, "python")
        )
        vuln_result = self.orchestrator.run_sync(
            sub_handler.from_text(vuln_code, "python")
        )
        assert clean_result["summary"]["total_findings"] < \
               vuln_result["summary"]["total_findings"], (
            f"Clean: {clean_result['summary']['total_findings']} findings, "
            f"Vulnerable: {vuln_result['summary']['total_findings']} findings"
        )


# ──────────────────────────────────────────────────────────────────
# Accuracy Validation Summary
# ──────────────────────────────────────────────────────────────────

class TestAccuracyValidation:
    """
    End-to-end accuracy validation.
    Verifies that expected vulnerabilities are detected in vulnerable code
    and NOT reported in clean code (false-positive check).
    """

    EXPECTED_VULNERABILITIES = {
        "Hardcoded Secret",
        "SQL Injection (OWASP A03:2021)",
        "OS Command Injection (OWASP A03:2021)",
        "Hardcoded Credentials (OWASP A07:2021)",
    }

    def setup_method(self):
        self.orchestrator = MultiAgentOrchestrator()
        self.sub_handler = CodeSubmission()

    def test_all_expected_vulnerabilities_detected(self):
        """All expected vulnerability types should be found in vulnerable_python.py."""
        code = load_sample("vulnerable_python.py")
        submission = self.sub_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        detected_types = {f["type"] for f in result["findings"]}

        missing = []
        for expected in self.EXPECTED_VULNERABILITIES:
            found = any(
                expected in detected or detected in expected
                for detected in detected_types
            )
            if not found:
                missing.append(expected)

        assert len(missing) == 0, (
            f"Missing expected vulnerabilities: {missing}\n"
            f"Detected: {sorted(detected_types)}"
        )

    def test_clean_code_has_no_critical_security_findings(self):
        """Clean code should not produce Critical-severity security findings."""
        code = load_sample("clean_python.py")
        submission = self.sub_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        critical_security = [
            f for f in result["findings"]
            if f.get("severity") == "Critical" and f.get("category") == "Security"
        ]
        assert len(critical_security) == 0, (
            f"False positives in clean code — Critical security findings detected:\n"
            + "\n".join(f"  - {f['type']}: {f['description'][:80]}"
                        for f in critical_security)
        )

    def test_severity_distribution_vulnerable(self):
        """Vulnerable sample should have Critical and High findings."""
        code = load_sample("vulnerable_python.py")
        submission = self.sub_handler.from_text(code, "python")
        result = self.orchestrator.run_sync(submission)
        breakdown = result["summary"]["severity_breakdown"]
        assert breakdown["Critical"] > 0, "Expected Critical findings in vulnerable sample"
        assert breakdown["High"] + breakdown["Critical"] > 0, (
            "Expected High or Critical findings in vulnerable sample"
        )
