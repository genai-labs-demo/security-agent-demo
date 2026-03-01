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
  8. Stored XSS (HTML)      — GET /security-xss-comments  (renders stored comments as HTML for pen-test detection)
  9. Reflected XSS (HTML)   — GET /security-xss-search?q= (reflects search query in HTML for pen-test detection)
"""

import json
import logging
import subprocess
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
        # Cast id to TEXT so string-based payloads (e.g. admin' --) work without type errors
        query = f"SELECT id, username, email, role, bio, created_at FROM security_users WHERE id::text = '{user_id}'"
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
    VULNERABILITY 3: Stored XSS — stores unsanitized user input (intentional for demo).
    FIXED: Mass Assignment vulnerability - rejects author_name and role from request body.
    """
    user_id = body.get("user_id")
    content = body.get("content")

    if not user_id or not content:
        return {"success": False, "error": "user_id and content are required"}

    # SECURITY FIX: Reject mass assignment attempts - author fields must not be user-controllable
    if "author_name" in body or "role" in body:
        logger.warning(f"[SECURITY] Mass assignment attempt blocked - author_name or role in request body")
        return {
            "success": False,
            "error": "Invalid request: author_name and role fields are not allowed. Identity attribution is controlled server-side.",
            "message": "Mass assignment attempt detected and blocked"
        }

    cursor = connection.cursor()
    try:
        logger.info(f"[VULNERABLE] Storing unsanitized comment: {content}")
        
        # Insert comment without accepting author fields from request body
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

        result = {"success": True, "data": row}
        if is_xss:
            result["message"] = "Stored XSS Detected"
            result["educational"] = _get_educational_content("xss_stored")
        else:
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

def render_xss_comments_page(connection):
    """
    GET /security-xss-comments
    VULNERABILITY: Stored XSS — renders stored comments as HTML without encoding.
    Returns text/html so pen-test scanners can detect stored XSS payloads executing
    in a real HTML page context (unlike the JSON API which returns application/json).
    """
    cursor = connection.cursor()
    try:
        cursor.execute("""
            SELECT c.id, c.user_id, c.content, c.author_name, c.author_role, c.created_at, u.username
            FROM security_comments c
            LEFT JOIN security_users u ON c.user_id = u.id
            ORDER BY c.created_at DESC
            LIMIT 50
        """)
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        comments_html = ""
        for row in rows:
            username = row.get("username") or "Anonymous"
            # VULNERABILITY: Stored XSS — content rendered directly in HTML without encoding
            content = row.get("content", "")
            comments_html += f"""
            <div style="border:1px solid #333;border-radius:6px;padding:12px;margin:8px 0;background:#16213e;">
                <strong style="color:#ffa07a;">{username}</strong>
                <div style="margin-top:6px;color:#e0e0e0;">{content}</div>
            </div>"""

        html = f"""<!DOCTYPE html>
<html>
<head><title>CRM Comments - Security Demo</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#1a1a2e;color:#e0e0e0;">
<h1 style="color:#ff6b6b;">CRM Comments Board</h1>
<p>Showing all comments from the CRM system.</p>
<div id="comments">{comments_html if comments_html else '<p>No comments yet.</p>'}</div>
<hr style="border-color:#333;margin:24px 0;">
<form method="GET" action="">
  <label for="q" style="color:#ffa07a;">Search comments:</label><br>
  <input type="text" name="q" id="q" style="padding:8px;width:60%;background:#0f3460;color:#e0e0e0;border:1px solid #533483;border-radius:4px;" placeholder="Search...">
  <button type="submit" style="padding:8px 16px;background:#e94560;color:white;border:none;border-radius:4px;cursor:pointer;">Search</button>
</form>
</body>
</html>"""

        return {"_html": True, "content": html}

    except Exception as e:
        logger.error(f"[VULNERABLE] Error rendering comments page: {str(e)}")
        connection.rollback()
        return {"_html": True, "content": f"<html><body><h1>Error</h1><p>{str(e)}</p></body></html>"}
    finally:
        cursor.close()


def render_xss_search_page(connection, query):
    """
    GET /security-xss-search?q=...
    VULNERABILITY: Reflected XSS — search query reflected directly in HTML response.
    Returns text/html so pen-test scanners can detect reflected XSS in a real HTML context.
    """
    results_html = ""
    if query:
        cursor = connection.cursor()
        try:
            cursor.execute("""
                SELECT c.id, c.content, c.created_at, u.username
                FROM security_comments c
                LEFT JOIN security_users u ON c.user_id = u.id
                WHERE c.content ILIKE %s
                ORDER BY c.created_at DESC
                LIMIT 20
            """, (f"%{query}%",))
            columns = [desc[0] for desc in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

            for row in rows:
                username = row.get("username") or "Anonymous"
                # VULNERABILITY: Stored XSS — content rendered without encoding
                content = row.get("content", "")
                results_html += f"""
                <div style="border:1px solid #333;border-radius:6px;padding:12px;margin:8px 0;background:#16213e;">
                    <strong style="color:#ffa07a;">{username}</strong>
                    <div style="margin-top:6px;color:#e0e0e0;">{content}</div>
                </div>"""

            if not rows:
                results_html = "<p>No results found.</p>"
        except Exception as e:
            logger.error(f"[VULNERABLE] Search error: {str(e)}")
            connection.rollback()
            results_html = f"<p>Search error: {str(e)}</p>"
        finally:
            cursor.close()

    # VULNERABILITY: Reflected XSS — query injected directly into HTML without encoding
    html = f"""<!DOCTYPE html>
<html>
<head><title>Search Results - Security Demo</title></head>
<body style="font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#1a1a2e;color:#e0e0e0;">
<h1 style="color:#ff6b6b;">Comment Search</h1>
<form method="GET" action="">
  <input type="text" name="q" value="{query}" style="padding:8px;width:60%;background:#0f3460;color:#e0e0e0;border:1px solid #533483;border-radius:4px;">
  <button type="submit" style="padding:8px 16px;background:#e94560;color:white;border:none;border-radius:4px;cursor:pointer;">Search</button>
</form>
<h2 style="color:#ffa07a;">Results for: {query}</h2>
<div id="results">{results_html}</div>
</body>
</html>"""

    return {"_html": True, "content": html}




# ============================================================
# 5 & 6. Command Injection — Ping endpoint (two vectors)
# ============================================================

def execute_ping(body):
    """
    POST /security-tools/ping
    VULNERABILITY 5: Command Injection — passes user input directly to shell.
    VULNERABILITY 6: Second vector — also supports 'command' field for direct execution.
    """
    host = body.get("host", "")
    # VULNERABILITY 6: Second command injection vector — direct command field
    custom_command = body.get("command", "")

    if not host and not custom_command:
        return {"success": False, "error": "Host parameter is required"}

    try:
        if custom_command:
            # VULNERABILITY: Direct command execution from user input
            command = custom_command
            logger.info(f"[VULNERABLE] Executing custom command: {command}")
        else:
            # VULNERABILITY: Command Injection — unsanitized input to shell
            # nslookup is reliably available in Lambda (ping is not)
            command = f"nslookup {host}"
            logger.info(f"[VULNERABLE] Executing command: {command}")

        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=10)
        output = result.stdout or result.stderr

        is_injection = _detect_command_injection(host or custom_command, output)
        if is_injection:
            return {
                "success": True,
                "message": "Command Injection Detected",
                "educational": _get_educational_content("command_injection"),
                "output": output,
            }
        return {"success": True, "output": output}

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out", "output": ""}
    except Exception as e:
        logger.error(f"[VULNERABLE] Command execution error: {str(e)}")
        return {"success": False, "error": "Command execution failed", "message": str(e)}


# ============================================================
# Command Injection — Nslookup endpoint (second distinct endpoint)
# ============================================================

def execute_nslookup(body):
    """
    POST /security-tools/nslookup
    VULNERABILITY: Command Injection — second distinct endpoint with shell=True.
    """
    host = body.get("host", "")
    if not host:
        return {"success": False, "error": "Host parameter is required"}

    try:
        # VULNERABILITY: Command Injection — unsanitized input to shell
        command = f"nslookup {host}"
        logger.info(f"[VULNERABLE] Executing nslookup command: {command}")

        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=10)
        output = result.stdout or result.stderr

        is_injection = _detect_command_injection(host, output)
        if is_injection:
            return {
                "success": True,
                "message": "Command Injection Detected",
                "educational": _get_educational_content("command_injection"),
                "output": output,
            }
        return {"success": True, "output": output}

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out", "output": ""}
    except Exception as e:
        logger.error(f"[VULNERABLE] Command execution error: {str(e)}")
        return {"success": False, "error": "Command execution failed", "message": str(e)}
