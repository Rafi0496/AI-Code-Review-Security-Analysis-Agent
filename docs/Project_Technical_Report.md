# Technical Report: AI Code Review & Security Analysis Platform

## 1. Executive Overview
The **AI Code Review & Analysis Agent** is an advanced, multi-agent AI platform designed to automate application security testing (SAST), detect code smells, and instantly generate secure code remediation. The system provides developers with real-time feedback on their code structure, identifies OWASP Top 10 vulnerabilities, and features an interactive Conversational Code Assistant to explain complex security concepts.

## 2. Technology Stack
The platform utilizes a modern, decoupled architecture separating the client interface from the high-performance API router, leveraging state-of-the-art Large Language Models (LLMs) for AI inference.

### Frontend (Client-Side)
*   **Framework**: React 18 + Vite (for lightning-fast Hot Module Replacement and optimized builds).
*   **Styling**: Tailwind CSS (utility-first CSS framework for custom Glassmorphism UI design).
*   **Icons & Assets**: Google Material Symbols (dynamic, variable-font typography icons).
*   **Deployment**: Vercel (Edge network deployment for maximum frontend availability).

### Backend (Server-Side)
*   **Framework**: FastAPI (high-performance, asynchronous Python web framework).
*   **Server**: Uvicorn (ASGI web server implementation for Python).
*   **Data Validation**: Pydantic (strict type enforcement for incoming API payloads).
*   **Routing**: Custom Universal AI Router bypassing standard restrictive SDKs for raw HTTP `urllib` / REST integration to avoid payload token bugs.

### AI Engine & Cloud APIs
The system implements a sophisticated 3-API workload distribution strategy to minimize latency and maximize task-specific accuracy:
*   **Groq Cloud (Llama 3.1 8B Instant)**: Powers the Conversational Chatbot and PR Summary Generator. Groq’s LPU (Language Processing Unit) architecture enables near-instantaneous response times (800+ tokens per second).
*   **Google Gemini (Gemini 1.5 Flash)**: Powers the Security Scanner and Remediation Agents. Utilizing Google's `v1beta` REST API, it processes complex source code strings and outputs strict, OWASP-aligned JSON matrices.

---

## 3. Multi-Agent Pipeline Architecture
The core innovation of the platform is the simultaneous coordination of specialized AI agents:

1.  **Code Analysis Agent (AST)**
    *   **Function**: Performs lightweight Static Application Security Testing (SAST).
    *   **Capabilities**: Parses the syntax tree to flag structural code smells such as "God Functions", bare exception clauses, and overly complex control flows.
2.  **Security Vulnerability Agent**
    *   **Function**: Deep-context vulnerability scanning.
    *   **Capabilities**: Cross-references input code against the OWASP Top 10 framework to accurately detect severe logic flaws like SQL Injections, Command Injections, Cross-Site Scripting (XSS), and hardcoded credentials.
3.  **Remediation Agent**
    *   **Function**: Automated code refactoring.
    *   **Capabilities**: Rather than providing superficial explanations, this agent guarantees secure code replacements by generating strict, enterprise-grade fixes (e.g., forcing parameterized queries or injecting environment variable requests).
4.  **Conversational Code Assistant**
    *   **Function**: Interactive RAG (Retrieval-Augmented Generation) Chatbot.
    *   **Capabilities**: Acts as an in-editor mentor, allowing developers to query the active code context and ask specific questions about the flagged vulnerabilities.

## 4. Key System Features
*   **Universal Dynamic Routing**: The backend intelligently routes requests between Groq and Gemini depending on the context window requirements and required latency, completely bypassing firewall errors (403/404) via custom user-agent headers.
*   **Live Execution Terminal**: The frontend UI features a simulated terminal log that traces the internal routing of the agents in real-time, providing deep transparency into the AI's decision-making process.
*   **Automated PDF Reporting**: The platform automatically compiles all findings, risk scores, and the generated remediation roadmap into a formalized Pull Request Summary Report, exportable as a cleanly formatted PDF directly from the browser.
*   **Low-Latency Optimizations**: Output token caps and strict temperature reductions (0.1) are applied to the AI models, forcing deterministic generation and keeping end-to-end processing times well under 10 seconds.

## 5. Conclusion
This project successfully demonstrates the integration of multiple distinct AI models into a single, cohesive software engineering tool. By combining the blazing speed of Groq's LLaMA 3.1 with the deep analytical capability of Google's Gemini, the platform acts as an invaluable, real-time security engineer for modern development pipelines.
