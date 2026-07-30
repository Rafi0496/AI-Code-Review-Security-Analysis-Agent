"""
Vulnerable Python sample — used for testing agents.
Contains intentional security issues and code smells.
"""

import sqlite3
import os
import hashlib

# ── VULNERABILITY 1: Hardcoded secret ───────────────────────
API_KEY = "sk-prod-abc123xyz789secret"
DB_PASSWORD = "admin123"


# ── VULNERABILITY 2: SQL Injection ──────────────────────────
def get_user(username, password):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()

    # SQL Injection: user input directly in query
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor.execute(query)
    user = cursor.fetchone()

    if user:
        return {"status": "success", "user": user}
    return {"status": "failed"}


# ── VULNERABILITY 3: Command Injection ─────────────────────
def ping_host(host):
    # Command injection: user input in shell command
    os.system("ping " + host)


# ── CODE SMELL 1: God Function (too long) ──────────────────
def process_everything(data, flag1, flag2, flag3, flag4, flag5, flag6):
    # Too many parameters (7)
    result = []
    if flag1:
        if flag2:
            if flag3:
                if flag4:
                    if flag5:
                        # Excessive nesting depth
                        for item in data:
                            if flag6:
                                result.append(item * 2)
                            else:
                                result.append(item)
    x = 0
    y = 0
    z = 0
    for i in range(100):
        x = x + i
        y = y * i + 1
        z = z - i
    temp = []
    for item in result:
        temp.append(item)
    result = temp
    output = []
    for r in result:
        output.append(str(r))
    final = ", ".join(output)
    return final


# ── CODE SMELL 2: Bare except ──────────────────────────────
def risky_operation(value):
    try:
        return int(value) / 0
    except:  # Bare except — catches everything including KeyboardInterrupt
        return None


# ── CODE SMELL 3: Weak hashing ─────────────────────────────
def hash_password(password: str) -> str:
    # MD5 is cryptographically broken — never use for passwords
    return hashlib.md5(password.encode()).hexdigest()


# ── VULNERABILITY 4: Insecure deserialization ───────────────
def load_user_data(serialized):
    import pickle
    # Pickle deserialization of untrusted data — RCE risk
    return pickle.loads(serialized)


class UserManager:
    # Missing docstring
    def __init__(self):
        self.users = {}
        self.admin_password = "admin123"  # Hardcoded credential

    def add_user(self, name, email, age, role, dept, team, level):
        # Too many parameters
        pass

    def process(self, x):
        # Magic numbers, poor naming
        if x > 42:
            return x * 3.14159 + 100
