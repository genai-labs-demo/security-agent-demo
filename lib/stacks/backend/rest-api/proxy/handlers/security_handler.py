"""
Security demo handler with INTENTIONAL vulnerabilities for educational purposes.
WARNING: This module contains deliberately vulnerable code for AWS Security Agent testing.
DO NOT use these patterns in production code.

Vulnerability inventory (matches pen-test target set):
  1. SQL Injection          — GET /security-profile/{id}  (string concatenation in SQL)
  2. IDOR                   — GET /security-profile/{id}  (sequential IDs, no auth check)
  3. Stored XSS             — POST /security-comments     (unsanitized content stored & returned)
  4. DOM-based / Reflected XSS — GET /security-xss-page?name=...  (reflected in HTML)
  5. Command Injection #1   — POST /security-tools/ping   (shell=True with user input)
  6. Command Injection #2   — POST /security-tools/ping   (pipe / semicolon chaining)
  7. Mass Assignment        — POST /security-comments     (author_name & role accepted from body)
"""

import json
import logging
import subprocess
import re
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# ============================================================
# Detection helpers (educational feedback only)
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
        "idor": {
            "vulnerability": "Insecure Direct Object Reference (IDOR)",
            "what_happened": "User profiles are accessible by sequential numeric IDs with no authentication or authorization check, allowing enumeration of all user data.",
            "how_agent_detects": "AWS Security Agent detects this by iterating through sequential IDs and verifying that data from other users is returned without authorization.",
            "sample_payloads": ["/security-profile/1", "/security-profile/2", "/security-profile/3"],
        },
        "mass_assignment": {
            "vulnerability": "Mass Assignment",
            "what_happened": "The API accepted and persisted fields (author_name, role) that should not be user-controllable, allowing comment authorship spoofing and privilege escalation.",
            "how_agent_detects": "AWS Security Agent detects this by submitting extra fields in POST requests and checking if they are persisted.",
            "sample_payloads": ['{"user_id":1,"content":"hi","author_name":"admin","role":"admin"}'],
        },
    }
    return content_map.get(vuln_type, {})


# ============================================================
# 1. SQL Injection + 2. IDOR — Profile endpoint
# ============================================================

def get_security_profile(connection, user_id):
    """
    GET /security-profile/{userId}
    VULNERABILITY 1: SQL Injection via string concatenation.
    VULNERABILITY 2: IDOR — any sequential ID returns data, no auth check.
    """
    cursor = connection.cursor()
    try:
        # VULNERABILITY: SQL Injection - string concatenation instead of parameterized query
        query = f"SELECT id, username, email, role, bio, created_at FROM security_users WHERE id = '{user_id}'"
        logger.info(f"[VULNERABLE] Executing SQL query: {query}")

        cursor.execute(query)
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        for row in rows:
            for key, val in row.items():
                if isinstance(val, datetime):
                    row[key] = val.isoformat()

        is_injection = _detect_sql_injection(user_id, rows)

        if is_injection:
            return {
                "success": True,
                "message": "SQL Injection Detected",
                "educational": _get_educational_content("sql_injection"),
                "data": rows if len(rows) != 1 else rows[0],
            }
        elif len(rows) == 0:
            return {"success": False, "error": "User not found"}
        else:
            # VULNERABILITY: IDOR — returns full user record for any ID without auth
            return {"success": True, "data": rows[0]}

    except Exception as e:
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
    """GET /security-profile — list all demo users (IDOR: full enumeration)"""
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
# 3. Stored XSS + 7. Mass Assignment — Comments endpoints
# ============================================================

def create_security_comment(connection, body):
    """
    POST /security-comments
    VULNERABILITY 3: Stored XSS — stores unsanitized user input.
    VULNERABILITY 7: Mass Assignment — accepts author_name and role from body.
    """
    user_id = body.get("user_id")
    content = body.get("content")

    if not user_id or not content:
        return {"success": False, "error": "user_id and content are required"}

    # VULNERABILITY: Mass Assignment — accept author_name and role from request body
    author_name = body.get("author_name")
    author_role = body.get("role")

    cursor = connection.cursor()
    try:
        logger.info(f"[VULNERABLE] Storing unsanitized comment: {content}")

        if author_name or author_role:
            # Mass Assignment: if attacker supplies author_name or role, persist them
            logger.info(f"[VULNERABLE] Mass assignment — author_name={author_name}, role={author_role}")
            cursor.execute(
                """INSERT INTO security_comments (user_id, content, author_name, author_role, created_at)
                   VALUES (%s, %s, %s, %s, NOW())
                   RETURNING id, user_id, content, author_name, author_role, created_at""",
                (user_id, content, author_name, author_role),
            )
        else:
            cursor.execute(
                """INSERT INTO security_comments (user_id, content, created_at)
                   VALUES (%s, %s, NOW())
                   RETURNING id, user_id, content, author_name, author_role, created_at""",
                (user_id, content),
            )
        connection.commit()
        columns = [desc[0] for desc in cursor.description]
        row = dict(zip(columns, cursor.fetchone()))
        for key, val in row.items():
            if isinstance(val, datetime):
                row[key] = val.isoformat()

        is_xss = _detect_xss(content)
        is_mass = bool(author_name or author_role)

        result = {"success": True, "data": row}
        if is_xss:
            result["message"] = "Stored XSS Detected"
            result["educational"] = _get_educational_content("xss_stored")
        if is_mass:
            result["message"] = result.get("message", "") + " | Mass Assignment Detected"
            result["educational_mass_assignment"] = _get_educational_content("mass_assignment")
        if not is_xss and not is_mass:
            result["message"] = "Comment created successfully"
        return result

    except Exception as e:
        connection.rollback()
        logger.error(f"[VULNERABLE] Database error: {str(e)}")
        return {"success": False, "error": "Failed to create comment", "message": str(e)}
    finally:
        cursor.close()


def list_security_comments(connection):
    """
    GET /security-comments
    VULNERABILITY: Stored XSS — returns unsanitized content.
    """
    cursor = connection.cursor()
    try:
        logger.info("[VULNERABLE] Retrieving comments without sanitization")
        cursor.execute("""
            SELECT c.id, c.user_id, c.content, c.author_name, c.author_role, c.created_at, u.username
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
                "message": "Stored XSS Detected in Comments",
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
# Reflected XSS — Search endpoint (JSON)
# ============================================================

def search_security_comments(connection, query):
    """
    GET /security-search?q=...
    VULNERABILITY: Reflected XSS — reflects search query without sanitization.
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
        for key_row in rows:
            for key, val in key_row.items():
                if isinstance(val, datetime):
                    key_row[key] = val.isoformat()

        is_xss = _detect_xss(query)
        if is_xss:
            return {
                "success": True,
                "query": query,
                "message": f"Reflected XSS Detected! You searched for: {query}",
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
# 4. DOM-based / Reflected XSS — HTML page endpoint
# ============================================================

def render_xss_page(query_params):
    """
    GET /security-xss-page?name=...
    VULNERABILITY 4: Reflected / DOM-based XSS — user input rendered directly in HTML.
    The 'name' query parameter is injected into the HTML without any encoding.
    A pen-test scanner will detect this because the response is Content-Type: text/html
    and the payload is reflected verbatim.
    """
    name = query_params.get("name", "Guest")
    search = query_params.get("q", "")

    logger.info(f"[VULNERABLE] Rendering HTML with unsanitized name={name}, q={search}")

    # VULNERABILITY: user input injected directly into HTML without encoding
    html = f"""<!DOCTYPE html>
<html>
<head><title>Security Demo - User Profile</title></head>
<body>
<h1>Welcome, {name}</h1>
<p>Your profile page is ready.</p>
<div id="search-results">
  <h2>Search Results for: {search}</h2>
  <p>No results found for your query.</p>
</div>
<script>
  // VULNERABILITY: DOM-based XSS — reads from URL fragment and injects into DOM
  var hash = window.location.hash.substring(1);
  if (hash) {{
    document.getElementById('search-results').innerHTML += '<p>Fragment: ' + hash + '</p>';
  }}
</script>
</body>
</html>"""

    return {"_html": True, "content": html}


# ============================================================
# Input Validation Helper - Command Injection Prevention
# ============================================================

def _is_valid_host(host):
    """
    Validate that the host is a valid hostname or IP address.
    This prevents command injection by rejecting shell metacharacters.
    
    Allowed patterns:
    - Domain names: alphanumeric, dots, hyphens (e.g., google.com, aws.amazon.com)
    - IPv4 addresses: 0-255.0-255.0-255.0-255
    - IPv6 addresses: hex digits with colons
    
    CWE-78: OS Command Injection Prevention
    """
    if not host or not isinstance(host, str):
        return False
    
    # Reject if contains shell metacharacters
    dangerous_chars = [';', '|', '&', '`', '$', '(', ')', '\n', '\r', '<', '>', '"', "'", '\\']
    if any(char in host for char in dangerous_chars):
        return False
    
    # Length check
    if len(host) > 253:  # Max domain name length
        return False
    
    # Valid hostname pattern (including localhost)
    hostname_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
    
    # Valid IPv4 pattern
    ipv4_pattern = r'^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$'
    
    # Valid IPv6 pattern (simplified)
    ipv6_pattern = r'^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$'
    
    return (re.match(hostname_pattern, host) is not None or 
            re.match(ipv4_pattern, host) is not None or 
            re.match(ipv6_pattern, host) is not None)


# ============================================================
# Command Injection FIXED - Ping endpoint
# ============================================================

def execute_ping(body):
    """
    POST /security-tools/ping
    SECURED: Command Injection vulnerabilities have been fixed.
    - Input validation using allowlist pattern
    - subprocess without shell=True
    - Arguments passed as list to prevent shell interpretation
    """
    host = body.get("host", "")
    
    if not host:
        return {"success": False, "error": "Host parameter is required"}
    
    # SECURITY FIX: Validate input to prevent command injection (CWE-78)
    if not _is_valid_host(host):
        logger.warning(f"[SECURITY] Invalid host rejected: {host}")
        return {
            "success": False, 
            "error": "Invalid host format. Please provide a valid hostname or IP address.",
            "security_note": "Command injection attempt blocked"
        }
    
    try:
        # SECURITY FIX: Use argument list with shell=False to prevent command injection
        logger.info(f"[SECURED] Executing ping for validated host: {host}")
        result = subprocess.run(
            ["ping", "-c", "2", "-W", "2", host],
            shell=False,
            capture_output=True,
            text=True,
            timeout=10
        )
        output = result.stdout or result.stderr
        return {"success": True, "output": output}
        
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out", "output": ""}
    except Exception as e:
        logger.error(f"[VULNERABLE] Command execution error: {str(e)}")
        return {"success": False, "error": "Command execution failed", "message": str(e)}


# ============================================================
# Command Injection FIXED - Nslookup endpoint
# ============================================================

def execute_nslookup(body):
    """
    POST /security-tools/nslookup
    SECURED: Command Injection vulnerability has been fixed.
    - Input validation using allowlist pattern
    - subprocess without shell=True
    - Arguments passed as list to prevent shell interpretation
    """
    host = body.get("host", "")
    if not host:
        return {"success": False, "error": "Host parameter is required"}
    
    # SECURITY FIX: Validate input to prevent command injection (CWE-78)
    if not _is_valid_host(host):
        logger.warning(f"[SECURITY] Invalid host rejected: {host}")
        return {
            "success": False,
            "error": "Invalid host format. Please provide a valid hostname or IP address.",
            "security_note": "Command injection attempt blocked"
        }
    
    try:
        # SECURITY FIX: Use argument list with shell=False to prevent command injection
        logger.info(f"[SECURED] Executing nslookup for validated host: {host}")
        result = subprocess.run(
            ["nslookup", host],
            shell=False,
            capture_output=True,
            text=True,
            timeout=10
        )
        output = result.stdout or result.stderr
        return {"success": True, "output": output}
        
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out", "output": ""}
    except Exception as e:
        logger.error(f"[VULNERABLE] Command execution error: {str(e)}")
        return {"success": False, "error": "Command execution failed", "message": str(e)}

