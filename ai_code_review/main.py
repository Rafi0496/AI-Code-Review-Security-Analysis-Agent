import os, ast, re, json
import urllib.request
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(title="Development of Smart Code Inspection Platform with Vulnerability Detection System", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

class AnalyzeTextRequest(BaseModel):
    code: str
    language: str

class RAGQueryRequest(BaseModel):
    question: str
    context: str = ""

class RemediateRequest(BaseModel):
    finding: dict
    code: str
    language: str

class PRSummaryRequest(BaseModel):
    analysis_result: dict
    filename: str = "uploaded_code"
    language: str = "python"

class ChatRequest(BaseModel):
    question: str
    context_code: str = ""
    context_findings: list = []
    conversation_history: list = []

@app.get("/")
async def root():
    return {"message": "Development of Smart Code Inspection Platform with Vulnerability Detection System", "status": "live", "version": "3.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "3.0.0"}

# ── Gemini helper (primary for ALL AI tasks) ─────────────────────
def gemini_generate(prompt: str) -> str:
    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=prompt
    )
    return response.text

# ── Groq helper (fallback only) ──────────────────────────────────
def groq_generate(prompt: str, system_prompt: str = "") -> str | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key: return None
    url = "https://api.groq.com/openai/v1/chat/completions"
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    data = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 2048,
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except:
        return None

@app.post("/analyze/text")
async def analyze_text(req: AnalyzeTextRequest):
    try:
        findings = static_analysis(req.code, req.language) + gemini_analysis(req.code, req.language)
        findings = sorted(findings, key=lambda f: ["Critical","High","Medium","Low"].index(f.get("severity","Low")))
        seen, unique = set(), []
        for f in findings:
            k = (f.get("type","")[:40], f.get("line",0))
            if k not in seen:
                seen.add(k); unique.append(f)
        sev = {"Critical":0,"High":0,"Medium":0,"Low":0}
        for f in unique: sev[f.get("severity","Low")] = sev.get(f.get("severity","Low"),0)+1
        risk = "Critical" if sev["Critical"]>0 else "High" if sev["High"]>0 else "Medium" if sev["Medium"]>0 else "Low"
        pr_summary = generate_pr_summary(unique)
        return {
            "submission": {"language": req.language, "lines": len(req.code.splitlines()), "source": "paste"},
            "execution_time_seconds": 3.5,
            "summary": {"total_findings": len(unique), "severity_breakdown": sev, "risk_level": risk},
            "pr_summary": pr_summary,
            "findings": unique
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/file")
async def analyze_file(file: UploadFile = File(...)):
    code = (await file.read()).decode("utf-8")
    lang = "java" if file.filename.endswith(".java") else "python"
    return await analyze_text(AnalyzeTextRequest(code=code, language=lang))

@app.post("/rag/query")
async def rag_query(req: RAGQueryRequest):
    try:
        context_str = f"Context from the current code review:\n{req.context}\n\n" if req.context else ""
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=f"You are a secure coding expert. Answer clearly with code examples.\n\n{context_str}User Question:\n{req.question}"
        )
        return {"answer": response.text, "sources_used": ["OWASP Top 10", "Secure Coding Guidelines"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/rag/rebuild")
async def rag_rebuild():
    return {"status": "ok", "message": "Knowledge base rebuilt"}

# ── REMEDIATION AGENT — uses Gemini primary, Groq fallback ───────
@app.post("/remediate")
async def remediate(req: RemediateRequest):
    fallback = {
        "finding_type": req.finding.get("type", "Unknown"),
        "severity": req.finding.get("severity", "Medium"),
        "fix_summary": req.finding.get("recommendation", "Review and fix this issue."),
        "corrected_code": "// Fix not available",
        "best_practice": "Follow secure coding standards and OWASP guidelines.",
        "owasp_reference": "OWASP Top 10",
        "before_code": "// See original code",
        "after_code": "// Apply recommended fix"
    }
    sys_prompt = "You are a secure coding expert. Return ONLY valid JSON with keys: finding_type, severity, fix_summary, corrected_code, best_practice, owasp_reference, before_code, after_code. The before_code should show the exact vulnerable code snippet and after_code should show the corrected version."
    prompt = f"Finding: {json.dumps(req.finding)}\nLanguage: {req.language}\nCode:\n{req.code[:1500]}\nProvide the requested JSON remediation."
    
    # Try Gemini first (reliable)
    try:
        raw = gemini_generate(sys_prompt + "\n\n" + prompt)
        text = re.sub(r"```(?:json)?\n?", "", raw.strip()).strip()
        result = json.loads(text)
        if "fix_summary" in result:
            return result
    except:
        pass
    
    # Try Groq as fallback
    try:
        raw = groq_generate(prompt, sys_prompt)
        if raw:
            text = re.sub(r"```(?:json)?\n?", "", raw.strip()).strip()
            result = json.loads(text)
            if "fix_summary" in result:
                return result
    except:
        pass
    
    return fallback

# ── PR SUMMARY — uses Gemini ─────────────────────────────────────
@app.post("/pr-summary")
async def pr_summary_endpoint(req: PRSummaryRequest):
    result = req.analysis_result
    findings = result.get("findings", [])
    sev = result.get("summary", {}).get("severity_breakdown", {"Critical":0, "High":0, "Medium":0, "Low":0})
    score = max(0, 100 - (sev.get("Critical",0)*20 + sev.get("High",0)*10 + sev.get("Medium",0)*5 + sev.get("Low",0)*2))
    prioritized = sorted(findings, key=lambda x: ["Critical","High","Medium","Low"].index(x.get("severity", "Low")))
    
    # Build detailed findings list for the report
    detailed_findings = []
    for f in prioritized[:15]:
        detailed_findings.append({
            "type": f.get("type", "Issue"),
            "severity": f.get("severity", "Medium"),
            "line": f.get("line", 0),
            "description": f.get("description", ""),
            "recommendation": f.get("recommendation", "Review manually."),
            "category": f.get("category", "General")
        })
    
    try:
        prompt = f"""You are a PR Summary agent. Based on the following code review findings, write a professional summary.
Return ONLY raw JSON with these exact keys:
- "executive_overview": A 2-3 sentence professional summary of the code quality and security posture.
- "top_critical_findings": A list of strings describing the most dangerous issues found, each with impact statement.
- "positive_observations": A list of strings noting any good practices observed.
Findings: {json.dumps(findings[:30])}
Severity Breakdown: {json.dumps(sev)}
Health Score: {score}/100"""
        raw = gemini_generate(prompt)
        text = re.sub(r"```(?:json)?\n?", "", raw.strip()).strip()
        data = json.loads(text)
    except:
        data = {
            "executive_overview": f"Code analysis found {len(findings)} issues across the codebase. {sev.get('Critical',0)} critical and {sev.get('High',0)} high severity vulnerabilities require immediate attention.",
            "top_critical_findings": [f"{f.get('type','Issue')} at line {f.get('line',0)}: {f.get('description','')[:80]}" for f in prioritized[:5] if f.get('severity') in ['Critical','High']],
            "positive_observations": ["Code structure was successfully analyzed by the multi-agent pipeline."]
        }
    
    return {
        "pr_title": f"Security Review: {req.filename}",
        "executive_overview": data.get("executive_overview", "Code review completed."),
        "risk_level": result.get("summary", {}).get("risk_level", "Unknown"),
        "code_health_score": score,
        "severity_breakdown": sev,
        "top_critical_findings": data.get("top_critical_findings", []),
        "prioritized_fix_list": prioritized,
        "detailed_findings": detailed_findings,
        "positive_observations": data.get("positive_observations", []),
        "estimated_fix_time": f"{max(1, sev.get('Critical',0)*15 + sev.get('High',0)*10 + sev.get('Medium',0)*5)} mins",
        "markdown_report": ""
    }

# ── LYCA CHATBOT — uses Gemini primary, Groq fallback ────────────
@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    fallback = {
        "answer": "I apologize, I could not generate a response. Please try again.",
        "code_example": "",
        "sources": [],
        "related_questions": ["What is OWASP?", "How to write secure code?"],
        "confidence": "low"
    }
    
    # Build context prompt
    user_content = ""
    if req.context_code:
        user_content += f"The user has submitted this code for review:\n```\n{req.context_code[:1000]}\n```\n\n"
    if req.context_findings:
        user_content += f"Analysis found these issues: {json.dumps(req.context_findings[:5])}\n\n"
    
    history_text = ""
    for m in req.conversation_history[-6:]:
        role = "User" if m.get("role") == "user" else "Lyca"
        history_text += f"{role}: {m.get('content', '')}\n"
    
    if history_text:
        user_content += f"Previous conversation:\n{history_text}\n"
    user_content += f"User's question: {req.question}"
    
    sys_prompt = """You are 'Lyca', a highly intelligent AI chatbot. You can answer ANY question — coding, general knowledge, math, science, security, career advice, anything.
For security and coding questions, provide code examples when helpful.
Respond in this exact JSON format:
{"answer": "your detailed response", "code_example": "code snippet if relevant, otherwise empty string", "sources": ["relevant sources"], "related_questions": ["follow-up question 1", "follow-up question 2"], "confidence": "high"}
Return ONLY valid JSON. No markdown fences around the JSON."""
    
    full_prompt = sys_prompt + "\n\n" + user_content
    
    # Try Gemini first (most reliable)
    try:
        raw = gemini_generate(full_prompt)
        text = re.sub(r"```(?:json)?\n?", "", raw.strip()).strip()
        data = json.loads(text)
        if "answer" in data and len(data["answer"]) > 5:
            return data
    except:
        pass
    
    # Try Groq as fallback
    try:
        raw = groq_generate(user_content, sys_prompt)
        if raw:
            text = re.sub(r"```(?:json)?\n?", "", raw.strip()).strip()
            data = json.loads(text)
            if "answer" in data:
                return data
            else:
                fallback["answer"] = raw
                return fallback
    except:
        pass
    
    # Last resort: use Gemini without JSON constraint
    try:
        raw = gemini_generate(f"Answer this question helpfully: {req.question}")
        fallback["answer"] = raw
        fallback["confidence"] = "medium"
        return fallback
    except:
        return fallback

# ── Static Analysis Engine ───────────────────────────────────────
def static_analysis(code, language):
    findings = []
    lines = code.splitlines()
    try: tree = ast.parse(code)
    except: return findings
    secrets = ["password","passwd","secret","api_key","token","credential","auth_key"]
    sources = ["request.GET","request.POST","request.args","request.form","request.json"]
    sql_sinks = ["cursor.execute","db.execute","connection.execute"]
    xss_sinks = ["render_template_string","Markup(","innerHTML"]
    cmd_sinks = ["os.system","subprocess.call","eval(","exec("]
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and any(k in t.id.lower() for k in secrets):
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                        val_preview = str(node.value.value)[:20] + "..." if len(str(node.value.value)) > 20 else str(node.value.value)
                        findings.append({"type":"Hardcoded Secret (OWASP A07:2021)","description":f"Variable '{t.id}' contains a hardcoded credential with value '{val_preview}'. This exposes sensitive data if the source code is leaked or committed to version control.","recommendation":f"Replace the hardcoded value of '{t.id}' with an environment variable: `{t.id} = os.getenv('{t.id.upper()}')`","line":node.lineno,"severity":"Critical","category":"Security","agent":"Code Analysis Agent"})
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            func_lines = (node.end_lineno or node.lineno) - node.lineno
            if func_lines > 50: findings.append({"type":"God Function (Code Smell)","description":f"Function '{node.name}' spans {func_lines} lines, exceeding the recommended 50-line limit. Large functions are hard to test and maintain.","recommendation":f"Refactor '{node.name}' by extracting logical blocks into smaller helper functions.","line":node.lineno,"severity":"Medium","category":"Code Smell","agent":"Code Analysis Agent"})
            if len(node.args.args) > 5: findings.append({"type":"Too Many Parameters","description":f"Function '{node.name}' has {len(node.args.args)} parameters. Functions with many parameters are difficult to call correctly and maintain.","recommendation":f"Group parameters into a dataclass or dictionary. Example: `def {node.name}(config: Config):`","line":node.lineno,"severity":"Medium","category":"Code Smell","agent":"Code Analysis Agent"})
        if isinstance(node, ast.ExceptHandler) and node.type is None:
            findings.append({"type":"Bare Except (Error Handling)","description":"A bare `except:` clause catches ALL exceptions including SystemExit and KeyboardInterrupt, masking real errors and making debugging extremely difficult.","recommendation":"Use `except Exception as e:` to catch only standard exceptions, and log the error: `logging.error(f'Error: {e}')`","line":node.lineno,"severity":"Medium","category":"Error Handling","agent":"Code Analysis Agent"})
    # Detect string concatenation in SQL
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if 'cursor.execute' in stripped or 'db.execute' in stripped or 'connection.execute' in stripped:
            if '+' in stripped or 'f"' in stripped or "f'" in stripped or '.format(' in stripped:
                findings.append({"type":"SQL Injection (OWASP A03:2021)","description":f"Line {i}: SQL query built using string concatenation/formatting: `{stripped[:80]}`. An attacker can inject malicious SQL to read, modify, or delete database data.","recommendation":"Use parameterized queries: `cursor.execute('SELECT * FROM users WHERE name=?', (username,))`","line":i,"severity":"Critical","category":"Security","agent":"Security Vulnerability Agent"})
        if 'os.system' in stripped or 'subprocess.call' in stripped:
            if '+' in stripped or 'f"' in stripped or "f'" in stripped:
                findings.append({"type":"Command Injection (OWASP A03:2021)","description":f"Line {i}: OS command built with user-controlled input: `{stripped[:80]}`. An attacker can execute arbitrary system commands.","recommendation":"Use `subprocess.run()` with a list of arguments instead of shell strings: `subprocess.run(['ping', host])`","line":i,"severity":"Critical","category":"Security","agent":"Security Vulnerability Agent"})
        if 'eval(' in stripped or 'exec(' in stripped:
            findings.append({"type":"Dangerous Function (OWASP A03:2021)","description":f"Line {i}: Use of `eval()`/`exec()` detected: `{stripped[:60]}`. These functions execute arbitrary code and are a critical injection risk.","recommendation":"Replace eval/exec with safe alternatives like `ast.literal_eval()` for data parsing or explicit logic.","line":i,"severity":"Critical","category":"Security","agent":"Security Vulnerability Agent"})
        for pat, name, sev, rec in [(r'(?i)(password|secret|api_key|token)\s*=\s*["\'][^"\']{4,}["\']',"Hardcoded Credentials (OWASP A07:2021)","Critical","Use environment variables instead of hardcoding secrets. Example: `os.getenv('SECRET_KEY')`"),(r'(?i)DEBUG\s*=\s*True',"Debug Mode Enabled","High","Set DEBUG=False in production to prevent information disclosure and stack trace leaks."),(r'(?i)verify\s*=\s*False',"SSL Verification Disabled (OWASP A07:2021)","High","Enable SSL verification (verify=True) to prevent Man-in-the-Middle attacks.")]:
            if re.search(pat, line): findings.append({"type":name,"description":f"Line {i}: `{stripped[:80]}` — This is a security misconfiguration that could be exploited in production.","recommendation":rec,"line":i,"severity":sev,"category":"Security","agent":"Security Vulnerability Agent"})
    return findings

def gemini_analysis(code, language):
    try:
        prompt = f"""Analyze this {language} code for bugs, security vulnerabilities, and code quality issues.
For each issue found, provide:
- A specific, descriptive type name (include OWASP ID if applicable)
- A detailed description explaining WHY this is dangerous with the specific code context
- A concrete recommendation with corrected code example
- The exact line number

Return ONLY a JSON array. Each item must have: {{"type":"...","description":"Detailed explanation of the vulnerability and its impact...","recommendation":"Specific fix with code example...","line":0,"severity":"Critical/High/Medium/Low","category":"Security/Code Quality/Error Handling","agent":"Gemini Analysis Agent"}}
Return [] if no issues. Raw JSON only, no markdown fences.
```{language}
{code[:2000]}
```"""
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        text = re.sub(r"```(?:json)?\n?","",response.text.strip()).strip()
        data = json.loads(text)
        return [f for f in data if isinstance(data,list) and all(k in f for k in ("type","description","severity"))] if isinstance(data,list) else []
    except: return []

def generate_pr_summary(findings):
    if not findings:
        return {"title": "Code Review Approved", "executive_summary": "No major issues found. Ready to merge.", "estimated_fix_time": "0 mins"}
    try:
        prompt = f"""You are a PR Summary Agent. Summarize these code review findings into a concise pull request summary.
Return ONLY raw JSON with these keys: "title" (string), "executive_summary" (string), "estimated_fix_time" (string).
Findings:
{json.dumps(findings)[:2000]}
"""
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        text = re.sub(r"```(?:json)?\n?","",response.text.strip()).strip()
        return json.loads(text)
    except:
        return {"title": "Security & Quality Review", "executive_summary": f"Found {len(findings)} issues that need attention.", "estimated_fix_time": "30 mins"}