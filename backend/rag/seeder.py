"""
Knowledge Base Seeder — Seeds ChromaDB with OWASP, secure coding,
and best practice documents for RAG retrieval.
"""
import asyncio
from rag.knowledge_base import knowledge_base

SEED_DOCUMENTS = [
    # ─── OWASP Top 10 ─────────────────────────────────────────────
    {
        "id": "owasp-a01-broken-access-control",
        "text": """OWASP A01:2021 – Broken Access Control
Access control enforces policy such that users cannot act outside of their intended permissions.
Failures typically lead to unauthorized information disclosure, modification, or destruction of data.

Common vulnerabilities:
- Bypassing access control checks by modifying URLs, HTML, or API requests
- Allowing primary key to be changed to another user's record (IDOR)
- Elevation of privilege: acting as an admin when logged in as a user
- Metadata manipulation (e.g., JWT token replay, cookie tampering)
- CORS misconfiguration allowing unauthorized API access
- Force browsing to authenticated pages as unauthenticated user

Prevention:
- Deny by default — deny access unless explicitly granted
- Implement server-side access control; client-side controls are bypassable
- Log access control failures and alert administrators
- Rate limit API and controller access to minimize IDOR attack impact
- Invalidate JWT tokens on server after logout
- Use centralized access control mechanisms
- Unit and integration test access control functions""",
        "metadata": {"title": "OWASP A01: Broken Access Control", "category": "OWASP", "severity": "high"},
    },
    {
        "id": "owasp-a02-cryptographic-failures",
        "text": """OWASP A02:2021 – Cryptographic Failures
Previously known as "Sensitive Data Exposure". Focuses on failures related to cryptography
which often lead to sensitive data exposure or system compromise.

Common vulnerabilities:
- Transmitting sensitive data in clear text (HTTP, FTP, SMTP)
- Using old or weak cryptographic algorithms (MD5, SHA1, DES, RC4)
- Using default or weak cryptographic keys; key reuse; improper key management
- Hardcoded passwords and secrets in source code
- Not enforcing encryption (missing HTTPS, HSTS headers)
- Storing passwords using unsalted or weak hash functions

Prevention:
- Classify data processed, stored, or transmitted; identify sensitive data
- Apply appropriate controls per data classification
- Don't store sensitive data unnecessarily; discard ASAP
- Encrypt all sensitive data at rest using AES-256
- Ensure up-to-date strong algorithms (TLS 1.2+, SHA-256+, RSA 2048+)
- Store passwords using adaptive salted hashing (Argon2, bcrypt, scrypt)
- Never use MD5, SHA1 for security; never use ECB mode
- Never hardcode secrets — use environment variables or secret managers""",
        "metadata": {"title": "OWASP A02: Cryptographic Failures", "category": "OWASP", "severity": "high"},
    },
    {
        "id": "owasp-a03-injection",
        "text": """OWASP A03:2021 – Injection
Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query.
SQL, NoSQL, OS command, LDAP, XML injection are common types.

SQL Injection example (vulnerable):
  query = "SELECT * FROM users WHERE username='" + username + "'"

SQL Injection example (safe — parameterized):
  cursor.execute("SELECT * FROM users WHERE username = %s", (username,))

XSS example (vulnerable Python/Jinja):
  return render_template_string("<h1>Hello " + name + "</h1>")

XSS example (safe):
  return render_template("hello.html", name=name)  # Jinja2 auto-escapes

Command Injection (vulnerable):
  os.system("ping " + user_input)

Command Injection (safe):
  subprocess.run(["ping", user_input], capture_output=True)

Prevention:
- Use parameterized queries / prepared statements for all DB queries
- Use ORMs that prevent injection (SQLAlchemy, Hibernate)
- Validate, filter, and sanitize all user-supplied input
- Escape special characters in dynamic queries
- Use LIMIT to reduce mass data disclosure in SQL injection
- Apply principle of least privilege to database accounts""",
        "metadata": {"title": "OWASP A03: Injection (SQL, XSS, Command)", "category": "OWASP", "severity": "critical"},
    },
    {
        "id": "owasp-a07-auth-failures",
        "text": """OWASP A07:2021 – Identification and Authentication Failures
Authentication and session management flaws allow attackers to compromise passwords,
keys, or session tokens, or exploit other implementation flaws.

Common vulnerabilities:
- Permits brute force or credential stuffing attacks
- Permits default, weak, or well-known passwords
- Uses weak or ineffective credential recovery (knowledge-based answers)
- Uses plain text, encrypted, or weakly hashed passwords
- Missing or ineffective multi-factor authentication
- Exposes session IDs in URLs
- Reuses session IDs after successful login (session fixation)
- Does not correctly invalidate session IDs during logout

Prevention:
- Implement multi-factor authentication to prevent credential stuffing
- Do not ship default credentials — require password change on first login
- Implement password strength checks using libraries like zxcvbn
- Use bcrypt, scrypt, or Argon2 for password storage
- Implement account lockout after failed login attempts (with CAPTCHA)
- Ensure session IDs are random, long, and stored securely (HttpOnly, Secure cookies)
- Invalidate session IDs on logout, idle, and absolute timeouts
- Use a server-side session manager (not client-side JWT-only sessions)""",
        "metadata": {"title": "OWASP A07: Authentication Failures", "category": "OWASP", "severity": "high"},
    },
    # ─── Python Secure Coding ─────────────────────────────────────
    {
        "id": "python-sql-injection",
        "text": """Python Secure Coding: SQL Injection Prevention

NEVER use string concatenation or f-strings to build SQL queries:
  # VULNERABLE:
  query = f"SELECT * FROM users WHERE id = {user_id}"
  cursor.execute(query)

  # ALSO VULNERABLE:
  query = "SELECT * FROM users WHERE name = '" + name + "'"

ALWAYS use parameterized queries:
  # SAFE — psycopg2:
  cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

  # SAFE — SQLAlchemy ORM:
  result = session.query(User).filter(User.id == user_id).first()

  # SAFE — SQLAlchemy Core with text():
  from sqlalchemy import text
  result = session.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})

Additional protections:
- Use database accounts with minimum necessary privileges
- Use SQLAlchemy or Django ORM instead of raw SQL where possible
- Validate input type/format before passing to DB
- Log and alert on SQL errors (may indicate injection attempts)""",
        "metadata": {"title": "Python SQL Injection Prevention", "category": "Python Security", "severity": "critical"},
    },
    {
        "id": "python-hardcoded-secrets",
        "text": """Python Secure Coding: Secrets Management

NEVER hardcode secrets in source code:
  # VULNERABLE:
  API_KEY = "sk-abc123xyz789"
  DB_PASSWORD = "mysecretpassword"
  SECRET_TOKEN = "hardcoded-jwt-secret"

ALWAYS use environment variables or secret managers:
  # SAFE — using os.environ:
  import os
  API_KEY = os.environ.get("API_KEY")
  if not API_KEY:
      raise ValueError("API_KEY environment variable not set")

  # SAFE — using python-dotenv:
  from dotenv import load_dotenv
  load_dotenv()
  API_KEY = os.getenv("API_KEY")

  # SAFE — using pydantic-settings:
  from pydantic_settings import BaseSettings
  class Settings(BaseSettings):
      api_key: str
      db_password: str
      class Config:
          env_file = ".env"

Best practices:
- Add .env to .gitignore immediately
- Use secrets managers (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager)
- Rotate secrets regularly
- Use different secrets per environment (dev, staging, prod)
- Use tools like truffleHog or git-secrets to scan for leaked secrets""",
        "metadata": {"title": "Python Secrets Management", "category": "Python Security", "severity": "critical"},
    },
    {
        "id": "python-command-injection",
        "text": """Python Secure Coding: Command Injection Prevention

NEVER pass user input directly to shell commands:
  # VULNERABLE — os.system:
  import os
  os.system("ping " + hostname)

  # VULNERABLE — shell=True with user input:
  import subprocess
  subprocess.run("ls " + user_dir, shell=True)

  # VULNERABLE — eval/exec with user input:
  eval(user_expression)

SAFE alternatives:
  # SAFE — subprocess with list arguments (no shell):
  import subprocess
  result = subprocess.run(["ping", "-c", "1", hostname], capture_output=True, text=True)

  # SAFE — use shlex.split for dynamic commands:
  import shlex
  args = shlex.split(safe_command_string)
  subprocess.run(args, capture_output=True)

  # SAFE — validate input against allowlist:
  ALLOWED_COMMANDS = {"ping", "nslookup"}
  if cmd not in ALLOWED_COMMANDS:
      raise ValueError("Command not allowed")

Never use:
- os.system() with user input
- subprocess with shell=True and user input
- eval() or exec() with user data""",
        "metadata": {"title": "Python Command Injection Prevention", "category": "Python Security", "severity": "critical"},
    },
    {
        "id": "python-input-validation",
        "text": """Python Secure Coding: Input Validation

Always validate and sanitize all user input before processing:

Type validation:
  # Using Pydantic for automatic validation:
  from pydantic import BaseModel, EmailStr, validator
  class UserInput(BaseModel):
      username: str
      email: EmailStr
      age: int

      @validator("username")
      def username_alphanumeric(cls, v):
          if not v.isalnum():
              raise ValueError("Username must be alphanumeric")
          return v

Length limits:
  MAX_CODE_LENGTH = 50000
  if len(user_code) > MAX_CODE_LENGTH:
      raise ValueError("Code exceeds maximum length")

File upload validation:
  ALLOWED_EXTENSIONS = {".py", ".java", ".js", ".ts"}
  ALLOWED_MIMETYPES = {"text/plain", "text/x-python"}
  
  if file.filename:
      ext = Path(file.filename).suffix.lower()
      if ext not in ALLOWED_EXTENSIONS:
          raise HTTPException(400, "File type not supported")

Sanitization for output:
  import html
  safe_output = html.escape(user_input)  # Prevents XSS""",
        "metadata": {"title": "Python Input Validation", "category": "Python Security", "severity": "high"},
    },
    # ─── Java Secure Coding ───────────────────────────────────────
    {
        "id": "java-sql-injection",
        "text": """Java Secure Coding: SQL Injection Prevention

VULNERABLE — String concatenation:
  String query = "SELECT * FROM users WHERE id = " + userId;
  Statement stmt = conn.createStatement();
  ResultSet rs = stmt.executeQuery(query);

SAFE — PreparedStatement (parameterized):
  String query = "SELECT * FROM users WHERE id = ?";
  PreparedStatement pstmt = conn.prepareStatement(query);
  pstmt.setInt(1, userId);
  ResultSet rs = pstmt.executeQuery();

SAFE — JPA/Hibernate (ORM):
  User user = entityManager.find(User.class, userId);

  // Named parameters:
  TypedQuery<User> query = em.createQuery(
      "SELECT u FROM User u WHERE u.username = :username", User.class);
  query.setParameter("username", username);

SAFE — Spring Data JPA:
  @Repository
  public interface UserRepository extends JpaRepository<User, Long> {
      Optional<User> findByUsername(String username);  // Auto parameterized
  }

Best practices:
- Always use PreparedStatement or ORM
- Apply principle of least privilege to DB user accounts
- Use stored procedures with parameterization
- Validate all input before DB operations""",
        "metadata": {"title": "Java SQL Injection Prevention", "category": "Java Security", "severity": "critical"},
    },
    {
        "id": "java-xss-prevention",
        "text": """Java Secure Coding: XSS Prevention

Cross-Site Scripting (XSS) occurs when user input is rendered in HTML without encoding.

VULNERABLE — JSP without encoding:
  <p>Hello <%= request.getParameter("name") %></p>

VULNERABLE — Servlet without encoding:
  response.getWriter().println("<p>" + name + "</p>");

SAFE — JSTL with output encoding:
  <c:out value="${param.name}" />

SAFE — Manual HTML encoding:
  import org.apache.commons.text.StringEscapeUtils;
  String safe = StringEscapeUtils.escapeHtml4(userInput);
  response.getWriter().println("<p>" + safe + "</p>");

SAFE — OWASP Java Encoder:
  import org.owasp.encoder.Encode;
  String safe = Encode.forHtml(userInput);

Content Security Policy header:
  response.setHeader("Content-Security-Policy",
      "default-src 'self'; script-src 'self'");

Framework-specific:
- Spring: Use Thymeleaf (auto-escapes by default: th:text)
- JSF: Use <h:outputText> (auto-escapes)
- React: JSX auto-escapes; avoid dangerouslySetInnerHTML""",
        "metadata": {"title": "Java XSS Prevention", "category": "Java Security", "severity": "high"},
    },
    # ─── Code Quality ─────────────────────────────────────────────
    {
        "id": "code-quality-solid-principles",
        "text": """SOLID Design Principles for Clean Code

S — Single Responsibility Principle (SRP)
A class should have only one reason to change.
BAD: UserManager handles authentication, user data, email sending, and logging.
GOOD: Split into Authenticator, UserRepository, EmailService, Logger.

O — Open/Closed Principle (OCP)
Classes should be open for extension but closed for modification.
Use abstract classes/interfaces so new behavior can be added without modifying existing code.

L — Liskov Substitution Principle (LSP)
Subclasses should be substitutable for their base classes without altering correctness.
Don't throw exceptions in overridden methods that the base class doesn't throw.

I — Interface Segregation Principle (ISP)
Don't force classes to implement interfaces they don't use.
Split large interfaces into smaller, specific ones.

D — Dependency Inversion Principle (DIP)
Depend on abstractions, not concrete implementations.
Use dependency injection; inject interfaces/abstract classes.

Example of DIP in Python:
  # BAD:
  class OrderService:
      def __init__(self):
          self.db = MySQLDatabase()  # Concrete dependency
  
  # GOOD:
  class OrderService:
      def __init__(self, db: AbstractDatabase):  # Interface dependency
          self.db = db""",
        "metadata": {"title": "SOLID Design Principles", "category": "Code Quality", "severity": "medium"},
    },
    {
        "id": "code-quality-code-smells",
        "text": """Common Code Smells and How to Fix Them

1. Long Method (> 20-30 lines)
   Fix: Extract smaller, focused methods with descriptive names

2. Large Class (God Object)
   Fix: Apply SRP; split into focused classes

3. Duplicate Code
   Fix: Extract to a shared method/class; DRY principle

4. Magic Numbers
   BAD:  if status == 3:
   GOOD: ACTIVE_STATUS = 3; if status == ACTIVE_STATUS:

5. Poor Naming
   BAD:  def calc(x, y): ...
   GOOD: def calculate_total_price(unit_price, quantity): ...

6. Dead Code (unused variables, unreachable code)
   Fix: Remove unused code; use linters (pylint, flake8, ESLint)

7. Too Many Parameters (> 3-4)
   Fix: Create a parameter object / data class

8. Feature Envy (method uses another class's data more than its own)
   Fix: Move method to the class it's envious of

9. Comments that explain WHAT instead of WHY
   Fix: Rename code to be self-documenting; comments for WHY

10. Inconsistent abstraction levels in a method
    Fix: Each method should operate at one level of abstraction""",
        "metadata": {"title": "Code Smells and Refactoring", "category": "Code Quality", "severity": "medium"},
    },
    {
        "id": "code-quality-error-handling",
        "text": """Best Practices: Error Handling and Exceptions

Python:
  # BAD — bare except catches everything including KeyboardInterrupt:
  try:
      risky_operation()
  except:
      pass  # Silent failure is dangerous

  # BAD — catching too broad:
  except Exception as e:
      print(e)  # No recovery, no re-raise

  # GOOD — specific exceptions:
  try:
      result = int(user_input)
  except ValueError:
      logger.warning("Invalid integer input: %s", user_input)
      raise HTTPException(400, "Input must be a valid integer")
  except DatabaseError as e:
      logger.error("Database error: %s", e)
      raise

  # GOOD — use finally for cleanup:
  try:
      file = open(path)
      process(file)
  except IOError as e:
      handle_error(e)
  finally:
      file.close()  # Or use 'with' statement

Java:
  // BAD — swallowing exceptions:
  try { riskyOp(); } catch (Exception e) { }

  // GOOD — log and rethrow or handle:
  try {
      riskyOp();
  } catch (SpecificException e) {
      logger.error("Failed: {}", e.getMessage(), e);
      throw new ServiceException("Operation failed", e);
  }""",
        "metadata": {"title": "Error Handling Best Practices", "category": "Code Quality", "severity": "medium"},
    },
    # ─── Security Headers & HTTPS ─────────────────────────────────
    {
        "id": "security-headers",
        "text": """HTTP Security Headers — Essential Configuration

Every web application should set these security headers:

Content-Security-Policy (CSP):
  Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'
  Prevents XSS by restricting resource origins.

HTTP Strict Transport Security (HSTS):
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Forces HTTPS; prevents SSL stripping attacks.

X-Frame-Options:
  X-Frame-Options: DENY
  Prevents clickjacking by blocking iframe embedding.

X-Content-Type-Options:
  X-Content-Type-Options: nosniff
  Prevents MIME type sniffing.

Referrer-Policy:
  Referrer-Policy: strict-origin-when-cross-origin

Permissions-Policy:
  Permissions-Policy: camera=(), microphone=(), geolocation=()

FastAPI/Python implementation:
  from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
  from starlette.middleware.base import BaseHTTPMiddleware
  
  class SecurityHeadersMiddleware(BaseHTTPMiddleware):
      async def dispatch(self, request, call_next):
          response = await call_next(request)
          response.headers["X-Content-Type-Options"] = "nosniff"
          response.headers["X-Frame-Options"] = "DENY"
          response.headers["Strict-Transport-Security"] = "max-age=31536000"
          return response""",
        "metadata": {"title": "HTTP Security Headers", "category": "Web Security", "severity": "medium"},
    },
    {
        "id": "owasp-top10-overview",
        "text": """OWASP Top 10 (2021) — Complete Overview

A01: Broken Access Control — Moving up from #5; 94% of apps tested
A02: Cryptographic Failures — Sensitive data exposure (was #3)
A03: Injection — SQL, NoSQL, OS, LDAP, XSS (was #1)
A04: Insecure Design — New category; design-level flaws
A05: Security Misconfiguration — Up from #6
A06: Vulnerable and Outdated Components — Was "Using Components with Known Vulnerabilities"
A07: Identification and Authentication Failures — Was "Broken Authentication"
A08: Software and Data Integrity Failures — New; insecure deserialization
A09: Security Logging and Monitoring Failures — Was #10
A10: Server-Side Request Forgery — New; added due to high severity

Severity mapping:
- Critical: A01, A02, A03 (when exploitable)
- High: A07, A08, A10
- Medium: A04, A05, A06, A09
- Low/Informational: A04 (design), A09 (logging gaps)

Tools for detection:
- SAST: Bandit (Python), SpotBugs (Java), Semgrep
- DAST: OWASP ZAP, Burp Suite
- SCA: OWASP Dependency Check, Snyk""",
        "metadata": {"title": "OWASP Top 10 Overview 2021", "category": "OWASP", "severity": "high"},
    },
    {
        "id": "python-file-upload-security",
        "text": """Python Secure Coding: File Upload Security

File uploads are a common attack vector for remote code execution and path traversal.

VULNERABLE:
  filename = request.files["file"].filename
  file.save(os.path.join("/uploads", filename))
  # Attacker can upload: ../../../etc/cron.d/malicious

SAFE — Use werkzeug.secure_filename:
  from werkzeug.utils import secure_filename
  import os
  
  UPLOAD_DIR = "/var/uploads"
  ALLOWED_EXTENSIONS = {".py", ".java", ".js", ".ts", ".txt"}
  MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
  
  def validate_upload(file):
      filename = secure_filename(file.filename)
      ext = os.path.splitext(filename)[1].lower()
      
      if ext not in ALLOWED_EXTENSIONS:
          raise ValueError(f"Extension {ext} not allowed")
      
      # Check file size
      file.seek(0, 2)  # Seek to end
      size = file.tell()
      file.seek(0)
      if size > MAX_FILE_SIZE:
          raise ValueError("File too large")
      
      # Safe path construction
      safe_path = os.path.join(UPLOAD_DIR, filename)
      # Verify path doesn't escape upload dir
      if not safe_path.startswith(os.path.abspath(UPLOAD_DIR)):
          raise ValueError("Path traversal detected")
      
      return safe_path, filename

Additional recommendations:
- Store files outside web root
- Rename files on upload (use UUID as filename)
- Scan uploaded files with antivirus
- Never execute uploaded files""",
        "metadata": {"title": "Python File Upload Security", "category": "Python Security", "severity": "high"},
    },
    {
        "id": "cwe-top25-overview",
        "text": """CWE/SANS Top 25 Most Dangerous Software Weaknesses (2023)

CWE-787: Out-of-bounds Write (rank 1)
CWE-79: Improper Neutralization of Input in Web Page (XSS) (rank 2)
CWE-89: SQL Injection (rank 3)
CWE-416: Use After Free (rank 4)
CWE-78: OS Command Injection (rank 5)
CWE-20: Improper Input Validation (rank 6)
CWE-125: Out-of-bounds Read (rank 7)
CWE-22: Path Traversal (rank 8)
CWE-352: Cross-Site Request Forgery (CSRF) (rank 9)
CWE-434: Unrestricted Upload of File with Dangerous Type (rank 10)
CWE-862: Missing Authorization (rank 11)
CWE-476: NULL Pointer Dereference (rank 12)
CWE-287: Improper Authentication (rank 13)
CWE-190: Integer Overflow (rank 14)
CWE-502: Deserialization of Untrusted Data (rank 15)
CWE-77: Command Injection (rank 16)
CWE-119: Buffer Overflow (rank 17)
CWE-798: Hardcoded Credentials (rank 18)
CWE-918: SSRF (rank 19)
CWE-306: Missing Auth for Critical Function (rank 20)

Python-relevant CWEs:
- CWE-89 (SQL Injection): Use parameterized queries
- CWE-79 (XSS): Use template auto-escaping
- CWE-78 (Command Injection): Use subprocess with list args
- CWE-798 (Hardcoded Creds): Use environment variables
- CWE-22 (Path Traversal): Use secure_filename()""",
        "metadata": {"title": "CWE Top 25 Weaknesses", "category": "Security Reference", "severity": "high"},
    },
    {
        "id": "secure-coding-authentication-jwt",
        "text": """Secure JWT Implementation Best Practices

JSON Web Tokens (JWT) are widely used for stateless authentication but have common pitfalls.

VULNERABLE patterns:
  # BAD — algorithm=none vulnerability:
  jwt.decode(token, verify=False)

  # BAD — weak secret:
  SECRET = "secret"  # Too short/predictable

  # BAD — missing expiry:
  payload = {"user_id": 1}  # No 'exp' claim

SAFE implementation:
  import jwt
  from datetime import datetime, timedelta, timezone
  import secrets
  
  SECRET = secrets.token_hex(32)  # 256-bit secret
  ALGORITHM = "HS256"  # Or RS256 for asymmetric
  
  def create_token(user_id: int) -> str:
      payload = {
          "sub": str(user_id),
          "iat": datetime.now(timezone.utc),
          "exp": datetime.now(timezone.utc) + timedelta(hours=24),
          "jti": secrets.token_urlsafe(16),  # Unique token ID for revocation
      }
      return jwt.encode(payload, SECRET, algorithm=ALGORITHM)
  
  def verify_token(token: str) -> dict:
      try:
          return jwt.decode(
              token, SECRET,
              algorithms=[ALGORITHM],  # Explicit algorithm list
              options={"require": ["exp", "sub", "iat"]},
          )
      except jwt.ExpiredSignatureError:
          raise AuthError("Token expired")
      except jwt.InvalidTokenError:
          raise AuthError("Invalid token")

Token storage:
- Store in httpOnly, Secure cookies (not localStorage) to prevent XSS theft
- Implement token refresh with short-lived access tokens (15-60 min)
- Maintain a revocation list for logout""",
        "metadata": {"title": "Secure JWT Implementation", "category": "Authentication", "severity": "high"},
    },
    {
        "id": "python-logging-security",
        "text": """Python Secure Logging Practices

Logging is essential but can introduce security vulnerabilities if done incorrectly.

Never log sensitive data:
  # VULNERABLE — logging passwords/tokens:
  logger.info(f"Login attempt: username={username}, password={password}")
  logger.debug(f"JWT token: {token}")
  logger.info(f"Credit card: {card_number}")

SAFE — log only necessary, non-sensitive info:
  logger.info(f"Login attempt for user: {username}")
  logger.info(f"Authentication {'successful' if success else 'failed'} for {username}")

Structured logging setup:
  import logging
  import json
  
  class SecureJSONFormatter(logging.Formatter):
      SENSITIVE_FIELDS = {"password", "token", "secret", "key", "card_number", "ssn"}
      
      def format(self, record):
          data = record.__dict__.copy()
          for field in self.SENSITIVE_FIELDS:
              if field in data:
                  data[field] = "[REDACTED]"
          return json.dumps(data)
  
  # Log security events:
  logger.warning("Failed login attempt", extra={
      "username": username,
      "ip_address": request.client.host,
      "timestamp": datetime.utcnow().isoformat(),
  })

Security events to always log:
- Authentication failures (with IP, username)
- Authorization failures (access denied events)
- Input validation failures (potential injection attempts)
- Admin actions (user creation, role changes)
- Errors in critical functions""",
        "metadata": {"title": "Python Secure Logging", "category": "Python Security", "severity": "medium"},
    },
]


async def seed_knowledge_base():
    """Seed ChromaDB with all secure coding documents."""
    print(f"[Seeder] Seeding knowledge base with {len(SEED_DOCUMENTS)} documents...")
    await knowledge_base.initialize()
    await knowledge_base.add_documents(SEED_DOCUMENTS)
    count = await knowledge_base.get_count()
    print(f"[Seeder] Knowledge base now contains {count} documents")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_knowledge_base())
