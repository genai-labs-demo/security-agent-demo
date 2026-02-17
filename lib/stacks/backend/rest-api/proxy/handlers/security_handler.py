"""
Security demo handler with INTENTIONAL vulnerabilities for educational purposes.
WARNING: This module contains deliberately vulnerable code for AWS Security Agent testing.
DO NOT use these patterns in production code.
"""

import json
import logging
import subprocess
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ============================================================
# SQL Injection Detection (educational)
# ============================================================

SQL_INJECTION_PATTERNS = ["'", "--", ";", "union", "select", "or ", "and ", "1=1", "*"]
XSS_PATTERNS = ["<script", "</script>", "javascript:", "onerror", "onload", "onclick",
                 "onmouseover", "<img", "<iframe", "<object", "<embed", "alert(", "document.cookie", "eval("]
CMD_INJECTION_PATTERNS = [";", "|", "&", "`", "$(", "\n", ">", "<"]


def _detect_sql_injection(user_input, results):
    lower = user_input.lower()
    has_pattern = any(p in lower for p in SQL_INJECTION_PATTERNS)
    unexpected_results = len(results) > 1 if results else False
    return has_pattern or unexpected_results


def _detect_xss(content):
    lower = content.lower()
    return any(p in lower for p in XSS_PATTERNS)


def _detect_command_injection(host, output):
    has_pattern = any(p in host for p in CMD_INJECTION_PATTERNS)
    has_unexpected = output and "PING" not in output and len(output) > 0
    has_many_lines = output and len(output.split("\n")) > 20
    return has_pattern or has_unexpected or has_many_lines


def _get_educational_content(vuln_type):
    content_map = {
        "sql_injection": {
            "vulnerability": "SQL Injection",
            "what_happened": "Your input was directly concatenated into the SQL query without parameterization, allowing you to manipulate the query logic.",
            "how_agent_detects": "AWS Security Agent detects this by testing various SQL injection payloads and analyzing query patterns for unauthorized data access.",
            "sample_payloads": ["1 OR 1=1", "1' OR '1'='1", "admin' --", "1' UNION SELECT * FROM security_users --"],
        },
        "xss_stored": {
            "vulnerability": "Stored Cross-Site Scripting (XSS)",
            "what_happened": "Your input was stored in the database without sanitization and is displayed without HTML encoding, allowing malicious scripts to execute.",
            "how_agent_detects": "AWS Security Agent detects this by submitting XSS payloads and checking if they are stored and reflected without encoding.",
            "sample_payloads": ['<script>alert("XSS")</script>', '<img src=x onerror=alert("XSS")>', '<svg onload=alert("XSS")>'],
        },
        "xss_reflected": {
            "vulnerability": "Reflected Cross-Site Scripting (XSS)",
            "what_happened": "Your input was directly reflected in the HTTP response without sanitization, allowing malicious scripts to execute.",
            "how_agent_detects": "AWS Security Agent detects this by submitting XSS payloads and checking if they are reflected in the response without encoding.",
            "sample_payloads": ['<script>alert("XSS")</script>', '<img src=x onerror=alert("XSS")>', 'javascript:alert("XSS")'],
        },
        "command_injection": {
            "vulnerability": "Command Injection",
            "what_happened": "Your input was directly passed to a system command without sanitization, allowing arbitrary command execution on the server.",
            "how_agent_detects": "AWS Security Agent detects this by testing command injection payloads and analyzing command execution patterns.",
            "sample_payloads": ["google.com; ls -la", "google.com | whoami", "google.com && cat /etc/passwd", "google.com; uname -a"],
        },
    }
    return content_map.get(vuln_type, {})


# ============================================================
# SQL Injection - Profile endpoint
# ============================================================

def get_security_profile(connection, user_id):
    """
    GET /security-profile/{userId}
    VULNERABILITY: SQL Injection via string concatenation.
    """
    cursor = connection.cursor()
    try:
        # VULNERABILITY: SQL Injection - string concatenation instead of parameterized query
        query = f"SELECT id, username, email, role, bio, created_at FROM security_users WHERE id = {user_id}"
        logger.info(f"[VULNERABLE] Executing SQL query: {query}")

        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Convert datetime objects to strings
        for row in rows:
            for key, val in row.items():
                if isinstance(val, datetime):
                    row[key] = val.isoformat()

        is_injection = _detect_sql_injection(user_id, rows)

        if is_injection:
            return {
                "success": True,
                "message": "🚨 Oh no! SQL Injection Detected!",
                "educational": _get_educational_content("sql_injection"),
                "data": rows if len(rows) != 1 else rows[0],
            }
        elif len(rows) == 0:
            return {"success": False, "error": "User not found"}
        else:
            return {"success": True, "data": rows[0]}

    except Exception as e:
        # VULNERABILITY: Expose database errors to the client
        logger.error(f"[VULNERABLE] Database error: {str(e)}")
        connection.rollback()
        return {
            "success": False,
            "error": "Database error",
            "message": str(e),
        }
    finally:
        cursor.close()


def list_security_profiles(connection):
    """GET /security-profile - list all demo users"""
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT id, username, email, role, bio, created_at FROM security_users ORDER BY id")
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        for row in rows:
            for key, val in row.items():
                if isinstance(val, datetime):
                    row[key] = val.isoformat()
        return {"success": True, "data": rows}
    except Exception as e:
        connection.rollback()
        return {"success": False, "error": str(e)}
    finally:
        cursor.close()


# ============================================================
# XSS - Comments endpoints
# ============================================================

def create_security_comment(connection, body):
    """
    POST /security-comments
    VULNERABILITY: Stored XSS - stores unsanitized user input.
    """
    user_id = body.get("user_id")
    content = body.get("content")

    if not user_id or not content:
        return {"success": False, "error": "user_id and content are required"}

    cursor = connection.cursor()
    try:
        # VULNERABILITY: Stored XSS - no sanitization of content
        logger.info(f"[VULNERABLE] Storing unsanitized comment: {content}")
        cursor.execute(
            "INSERT INTO security_comments (user_id, content, created_at) VALUES (%s, %s, NOW()) RETURNING id, user_id, content, created_at",
            (user_id, content),
        )
        connection.commit()
        columns = [desc[0] for desc in cursor.description]
        row = dict(zip(columns, cursor.fetchone()))
        for key, val in row.items():
            if isinstance(val, datetime):
                row[key] = val.isoformat()

        is_xss = _detect_xss(content)
        if is_xss:
            return {
                "success": True,
                "message": "🚨 Oh no! Stored XSS Detected!",
                "educational": _get_educational_content("xss_stored"),
                "data": row,
            }
        return {"success": True, "message": "Comment created successfully", "data": row}

    except Exception as e:
        connection.rollback()
        logger.error(f"[VULNERABLE] Database error: {str(e)}")
        return {"success": False, "error": "Failed to create comment", "message": str(e)}
    finally:
        cursor.close()


def list_security_comments(connection):
    """
    GET /security-comments
    VULNERABILITY: Stored XSS - returns unsanitized content.
    """
    cursor = connection.cursor()
    try:
        logger.info("[VULNERABLE] Retrieving comments without sanitization")
        cursor.execute("""
            SELECT c.id, c.user_id, c.content, c.created_at, u.username
            FROM security_comments c
            LEFT JOIN security_users u ON c.user_id = u.id
            ORDER BY c.created_at DESC
        """)
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        for row in rows:
            for key, val in row.items():
                if isinstance(val, datetime):
                    row[key] = val.isoformat()

        has_xss = any(_detect_xss(r.get("content", "")) for r in rows)
        if has_xss:
            return {
                "success": True,
                "message": "🚨 Oh no! Stored XSS Detected in Comments!",
                "educational": _get_educational_content("xss_stored"),
                "data": rows,
            }
        return {"success": True, "data": rows}

    except Exception as e:
        connection.rollback()
        return {"success": False, "error": "Failed to retrieve comments", "message": str(e)}
    finally:
        cursor.close()


# ============================================================
# Reflected XSS - Search endpoint
# ============================================================

def search_security_comments(connection, query):
    """
    GET /security-search?q=...
    VULNERABILITY: Reflected XSS - reflects search query without sanitization.
    """
    cursor = connection.cursor()
    try:
        logger.info(f"[VULNERABLE] Reflecting unsanitized search query: {query}")
        cursor.execute("""
            SELECT c.id, c.user_id, c.content, c.created_at, u.username
            FROM security_comments c
            LEFT JOIN security_users u ON c.user_id = u.id
            WHERE c.content ILIKE %s
            ORDER BY c.created_at DESC
        """, (f"%{query}%",))
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        for row in rows:
            for key, val in row.items():
                if isinstance(val, datetime):
                    row[key] = val.isoformat()

        is_xss = _detect_xss(query)
        if is_xss:
            return {
                "success": True,
                "query": query,
                "message": f"🚨 Oh no! Reflected XSS Detected! You searched for: {query}",
                "educational": _get_educational_content("xss_reflected"),
                "data": rows,
            }
        return {
            "success": True,
            "query": query,
            "message": f"You searched for: {query}",
            "data": rows,
        }

    except Exception as e:
        connection.rollback()
        return {"success": False, "query": query, "message": f"Search failed for: {query}", "error": str(e)}
    finally:
        cursor.close()


# ============================================================
# Command Injection - Ping endpoint
# ============================================================

def execute_ping(body):
    """
    POST /security-tools/ping
    VULNERABILITY: Command Injection - passes user input directly to shell.
    """
    host = body.get("host", "")
    if not host:
        return {"success": False, "error": "Host parameter is required"}

    try:
        # VULNERABILITY: Command Injection - unsanitized input to shell
        command = f"ping -c 2 -W 2 {host}"
        logger.info(f"[VULNERABLE] Executing command: {command}")

        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=10)
        output = result.stdout or result.stderr

        is_injection = _detect_command_injection(host, output)
        if is_injection:
            return {
                "success": True,
                "message": "🚨 Oh no! Command Injection Detected!",
                "educational": _get_educational_content("command_injection"),
                "output": output,
            }
        return {"success": True, "output": output}

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out", "output": ""}
    except Exception as e:
        # VULNERABILITY: Expose command execution errors
        logger.error(f"[VULNERABLE] Command execution error: {str(e)}")
        return {"success": False, "error": "Command execution failed", "message": str(e)}
