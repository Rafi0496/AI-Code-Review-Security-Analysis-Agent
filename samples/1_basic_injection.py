import sqlite3
import os

API_KEY = "sk-prod-abc123xyz789"

def get_user_data(username):
    # OWASP A03:2021 - SQL Injection
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE name='{username}'"
    cursor.execute(query)
    return cursor.fetchone()

def ping_server(ip_address):
    # OWASP A03:2021 - Command Injection
    os.system(f"ping -c 4 {ip_address}")

def risky_divide(value):
    # Code Smell: Bare except
    try:
        return 100 / int(value)
    except:
        return None
