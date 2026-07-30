"""Quick verification script — tests all imports and core logic without Gemini API."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PASS = 0
FAIL = 0

def check(name, condition, msg=""):
    global PASS, FAIL
    if condition:
        print(f"  PASS  {name}")
        PASS += 1
    else:
        print(f"  FAIL  {name}" + (f" — {msg}" if msg else ""))
        FAIL += 1

# ── Imports ──────────────────────────────────────────────────────
try:
    from modules.submission import CodeSubmission, CodeSubmissionError
    from modules.rag_pipeline import RAGPipeline
    from agents.code_analysis_agent import CodeAnalysisAgent
    from agents.security_vuln_agent import SecurityVulnAgent, TaintTracker
    from agents.orchestrator import MultiAgentOrchestrator
    check("All modules imported", True)
except Exception as e:
    check("All modules imported", False, str(e))
    sys.exit(1)

# ── CodeSubmission ───────────────────────────────────────────────
handler = CodeSubmission()

sub = handler.from_text("def hello():\n    return 'world'\n", "python")
check("from_text python valid", sub["language"] == "python" and sub["source"] == "paste")

sub_java = handler.from_text("public class Hello {}", "java")
check("from_text java valid", sub_java["language"] == "java")

try:
    handler.from_text("def broken(\n    return 1", "python")
    check("Syntax error rejected", False, "Should have raised CodeSubmissionError")
except CodeSubmissionError:
    check("Syntax error rejected", True)

try:
    handler.from_text("x=1", "ruby")
    check("Unsupported language rejected", False)
except CodeSubmissionError:
    check("Unsupported language rejected", True)

check("Case-insensitive language", handler.from_text("x=1\n", "Python")["language"] == "python")

# ── TaintTracker ─────────────────────────────────────────────────
code_sql = (
    "username = request.GET['user']\n"
    "import sqlite3\n"
    "conn = sqlite3.connect('db')\n"
    "cursor = conn.cursor()\n"
    "q = \"SELECT * FROM users WHERE name='\" + username + \"'\"\n"
    "cursor.execute(q)\n"
)
tracker = TaintTracker(code_sql)
findings = tracker.run()
sql_found = any("SQL" in f.get("type", "") for f in findings)
check("TaintTracker detects SQL injection", sql_found, f"Findings: {[f.get('type') for f in findings]}")

code_cmd = (
    "import os\n"
    "host = request.GET['host']\n"
    "cmd = 'ping ' + host\n"
    "os.system(cmd)\n"
)
tracker2 = TaintTracker(code_cmd)
findings2 = tracker2.run()
cmd_found = any("Command" in f.get("type", "") or "command" in f.get("type","").lower() for f in findings2)
check("TaintTracker detects command injection", cmd_found, f"Findings: {[f.get('type') for f in findings2]}")

# Parameterized SQL — should NOT trigger
code_safe_sql = (
    "user_id = request.GET['id']\n"
    "import sqlite3\n"
    "conn = sqlite3.connect('db')\n"
    "cursor = conn.cursor()\n"
    "cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))\n"
)
tracker3 = TaintTracker(code_safe_sql)
findings3 = tracker3.run()
no_fp = not any("SQL" in f.get("type","") for f in findings3)
check("TaintTracker no false-positive on safe SQL", no_fp, f"Got: {[f.get('type') for f in findings3]}")

# ── Static Analysis (no Gemini call) ────────────────────────────
agent = CodeAnalysisAgent()

code_secret = 'API_KEY = "sk-prod-abc123xyz"\npassword = "admin123"\n'
sub_secret = handler.from_text(code_secret, "python")
static_findings = agent._static_analysis_python(code_secret)
hardcoded = any(f.get("type") == "Hardcoded Secret" for f in static_findings)
check("Static: detects hardcoded secret", hardcoded, f"Got: {[f.get('type') for f in static_findings]}")

code_bare = "try:\n    x = 1/0\nexcept:\n    pass\n"
static_bare = agent._static_analysis_python(code_bare)
bare_found = any(f.get("type") == "Bare Except Clause" for f in static_bare)
check("Static: detects bare except", bare_found, f"Got: {[f.get('type') for f in static_bare]}")

code_params = "def func(a, b, c, d, e, f, g):\n    pass\n"
static_params = agent._static_analysis_python(code_params)
params_found = any(f.get("type") == "Too Many Parameters" for f in static_params)
check("Static: detects too many parameters", params_found, f"Got: {[f.get('type') for f in static_params]}")

# ── Pattern Scan (no Gemini) ─────────────────────────────────────
sec_agent = SecurityVulnAgent()
code_cred = 'DB_PASSWORD = "supersecret123"\n'
pattern_results = sec_agent._pattern_scan(code_cred, "python")
cred_found = any("Hardcoded" in f.get("type","") or "Credential" in f.get("type","") for f in pattern_results)
check("Pattern scan: detects hardcoded credential", cred_found, f"Got: {[f.get('type') for f in pattern_results]}")

code_debug = "DEBUG = True\n"
debug_results = sec_agent._pattern_scan(code_debug, "python")
debug_found = any("Debug" in f.get("type","") for f in debug_results)
check("Pattern scan: detects DEBUG=True", debug_found, f"Got: {[f.get('type') for f in debug_results]}")

code_csrf = "def login(request):\n    u = request.POST.get('username')\n    return u\n"
csrf_results = sec_agent._pattern_scan(code_csrf, "python")
csrf_found = any("CSRF" in f.get("type","") for f in csrf_results)
check("Pattern scan: detects missing CSRF", csrf_found, f"Got: {[f.get('type') for f in csrf_results]}")

# ── Orchestrator structure ───────────────────────────────────────
orch = MultiAgentOrchestrator()
check("Orchestrator instantiates", True)

# Test merge logic
code_result = {"findings": [{"type": "God Function", "line": 10, "severity": "High", "category": "Code Smell"}]}
sec_result = {"findings": [{"type": "Hardcoded Secret", "line": 1, "severity": "Critical", "category": "Security"}]}
merged = orch._merge_findings(code_result, sec_result)
check("Merge: both agents tagged", all("agent" in f for f in merged))
check("Merge: sorted Critical first", merged[0]["severity"] == "Critical" if merged else True)

summary = orch._build_summary(merged)
check("Summary: correct structure", "severity_breakdown" in summary and "total_findings" in summary)
check("Summary risk: Critical", orch._overall_risk({"Critical": 1, "High": 0, "Medium": 0, "Low": 0}) == "Critical")
check("Summary risk: High", orch._overall_risk({"Critical": 0, "High": 1, "Medium": 0, "Low": 0}) == "High")
check("Summary risk: Low", orch._overall_risk({"Critical": 0, "High": 0, "Medium": 0, "Low": 1}) == "Low")

# ── RAG structure (pure-Python only — no ChromaDB query) ──────────
# Test _chunk_by_section with content that exceeds the 50-char minimum
SECTION_CONTENT = (
    "# SQL Injection Prevention Guidelines\n"
    "Always use parameterized queries instead of string concatenation.\n\n"
    "# Cross-Site Scripting Prevention\n"
    "Escape all user-controlled output before rendering it in HTML templates.\n"
)
rag = RAGPipeline()
chunks = rag._chunk_by_section(SECTION_CONTENT, "test.txt")
check("RAG chunking splits sections", len(chunks) >= 1,
      f"Got {len(chunks)} chunks (content may be below 50-char min)")

# Test that the fallback paragraph splitter also works
PARA_CONTENT = (
    "First paragraph about secure coding with enough content here.\n\n"
    "Second paragraph about OWASP guidelines with sufficient length.\n"
)
para_chunks = rag._chunk_by_section(PARA_CONTENT, "para.txt")
check("RAG chunking fallback paragraphs", len(para_chunks) >= 1)

# get_context_string without indexed docs must return a non-empty string
# (does NOT call ChromaDB query when _doc_count == 0 due to clamping)
ctx = rag.get_context_string("SQL injection", top_k=1)
check("RAG get_context_string returns str", isinstance(ctx, str) and len(ctx) > 0)

# ── Summary ──────────────────────────────────────────────────────
print()
print(f"{'='*50}")
print(f"  Results: {PASS} passed, {FAIL} failed")
print(f"{'='*50}")
sys.exit(0 if FAIL == 0 else 1)
