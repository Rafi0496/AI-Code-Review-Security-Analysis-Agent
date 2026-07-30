# AI Code Review and Security Analysis Agent

An intelligent, multi-agent platform designed to automatically analyze source code for quality issues, security vulnerabilities, and adherence to secure coding best practices.

## Live Deployments

- Frontend Application: [https://ai-code-review-security-analysis-ag.vercel.app](https://ai-code-review-security-analysis-ag.vercel.app)
- Backend API (Render): [https://ai-code-review-security-analysis-agent.onrender.com](https://ai-code-review-security-analysis-agent.onrender.com)

## Architecture Overview

The system is built on a modern, decoupled full-stack architecture:

1. Frontend Interface: A responsive, React-based web application powered by Vite. It provides a dedicated workspace for code submission, comprehensive analysis reports, and an interactive conversational assistant.
2. Backend Services: A high-performance Python FastAPI server handling code parsing, routing, and orchestration.
3. Multi-Agent Pipeline: Powered by the Google Gemini 2.0 Flash model via the official `google-genai` SDK. The pipeline includes specialized agents for static code analysis, security vulnerability detection (OWASP Top 10), and contextual security assistance.

## Key Features

- Automated Code Analysis: Detects code smells, high cyclomatic complexity, and design anti-patterns.
- Security Vulnerability Scanning: Identifies critical security risks, including Hardcoded Secrets, SQL Injection, Cross-Site Scripting (XSS), and Command Injection, categorizing them by severity.
- Conversational RAG Assistant: An integrated chat widget that answers contextual questions regarding secure coding practices and OWASP guidelines.
- Multi-Language Support: Capable of analyzing both Python and Java source code.
- Modern Developer Interface: A glassmorphism-inspired, dark-mode dashboard tailored for a premium developer experience.

## Local Setup and Installation

### Prerequisites
- Python 3.11 or higher
- Node.js 20 or higher
- A Google Gemini API Key

### Backend Installation

1. Navigate to the project root directory.
2. Install the required Python dependencies:
   ```bash
   pip install -r ai_code_review/requirements.txt
   ```
3. Create a `.env` file in the root directory and add your API key:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn ai_code_review.main:app --reload --port 8000
   ```
   The backend API will be available at `http://localhost:8000`.

### Frontend Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application will be available at `http://localhost:5173`. By default, it will automatically route API requests to the live production backend.

## Project Structure

```text
.
├── ai_code_review/
│   ├── main.py                 # FastAPI application and Agent orchestration
│   ├── requirements.txt        # Python backend dependencies
│   └── knowledge_base/         # Text documents for RAG context
├── frontend/
│   ├── src/                    # React frontend source code
│   ├── package.json            # Node frontend dependencies
│   └── vite.config.js          # Vite configuration
└── README.md                   # Project documentation
```

## Disclaimer

This project is intended for educational and academic purposes as a Capstone Project.
