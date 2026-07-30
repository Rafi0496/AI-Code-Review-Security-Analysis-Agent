# AI Code Analysis Agent
## Complete Implementation (Frontend & Backend)

**AI Code Analysis Agent** is a state-of-the-art, multi-agent platform for automated code quality and security analysis. Powered by the Google Gemini API, AST analysis, Bandit, and Radon, it provides deep insights into your codebase.

---

## 🌟 Key Features

* **Auto-Language Detection:** Paste your code and the system instantly recognizes whether it's Python or Java.
* **Multi-Agent Architecture:** Features parallel execution of a Code Analysis Agent and a Security Vulnerability Agent, orchestrated together for comprehensive results.
* **Floating Security Agent Widget:** An interactive, Glassmorphism-styled RAG chatbot at the bottom-right of your screen. Ask it any security-related questions, and it synthesizes conversational answers using the OWASP Knowledge Base and Gemini 2.0 Flash.
* **Markdown Export:** Download your entire analysis report, perfectly formatted in Markdown (`.md`), detailing every vulnerability, severity, and recommendation.
* **Premium Glassmorphism UI:** Built with Vite + React, featuring smooth hover states, off-white typography, and a modern dark aesthetic.

---

## 🚀 Quick Start

You will need to run the **Backend (FastAPI)** and the **Frontend (Vite/React)** in two separate terminals.

### 1. Start the Backend
Open a terminal and run:
```bash
cd ai_code_review

# Install dependencies
pip install -r requirements.txt

# Run the API server
python -m uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend
Open a **new** terminal and run:
```bash
cd frontend

# Install dependencies
npm install

# Run the UI server
npm run dev
# (Or on Windows if npm run dev fails: node node_modules\vite\bin\vite.js)
```

**View the app at:** [http://localhost:5173](http://localhost:5173)

---

## 📂 Project Structure

```text
AI Code Review & Analysis agent/
├── ai_code_review/                 # FastAPI Backend
│   ├── main.py                     # API entry point & endpoints
│   ├── requirements.txt
│   ├── .env                        # GEMINI_API_KEY
│   ├── modules/
│   │   ├── submission.py           # Code Submission Module
│   │   └── rag_pipeline.py         # RAG Knowledge Base Builder
│   ├── agents/
│   │   ├── code_analysis_agent.py  # Code smells & complexity (Gemini + AST)
│   │   ├── security_vuln_agent.py  # Vulnerabilities (Gemini + Taint + Bandit)
│   │   └── orchestrator.py         # Parallel execution coordinator
│   ├── knowledge_base/             # OWASP txt documents for RAG
│   └── tests/                      # 40+ pytest cases
│
└── frontend/                       # Vite + React Frontend
    ├── index.html
    ├── src/
    │   ├── App.jsx                 # Main application & Security Widget
    │   ├── api/client.js           # API integration layer
    │   └── styles/index.css        # Glassmorphism design system
```

---

## 🛡️ Detected Vulnerabilities & Coverage

The platform maps findings directly to the **OWASP Top 10**:
* **A01: Broken Access Control** (CSRF, Path Traversal)
* **A02: Cryptographic Failures** (Weak hashing, MD5)
* **A03: Injection** (SQL Injection, Command Injection, XSS)
* **A05: Security Misconfiguration**
* **A07: Identification and Authentication Failures** (Hardcoded credentials)

The backend utilizes the `google.genai` SDK and **Gemini 2.0 Flash** for both the static code analysis and the conversational RAG chatbot.
