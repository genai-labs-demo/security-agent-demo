/**
 * Advanced XSS Security Lab — inline on the Pipeline page.
 * Demonstrates DOM-based and reflected XSS via URL parameters.
 * Collapsed by default; expands to show education + try-it-yourself.
 */
import { useState, useRef } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Button, ColumnLayout, ExpandableSection,
  Input, SpaceBetween, Alert,
} from "@cloudscape-design/components";

const API = import.meta.env.VITE_REST_API_URL?.replace(/\/$/, "") ?? "";

const PAYLOADS = [
  { label: "Reflected name", value: '<script>alert("XSS")</script>' },
  { label: "Image onerror", value: '<img src=x onerror=alert(document.domain)>' },
  { label: "SVG onload", value: '<svg/onload=alert("XSS")>' },
  { label: "Body event", value: '<body onload=alert("XSS")>' },
];

const AdvancedXSSLab = () => {
  const [name, setName] = useState("Guest");
  const [res, setRes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const tryReflected = async (v?: string) => {
    const n = v ?? name;
    if (!n.trim()) return;
    setBusy(true); setErr(null); setRes(null); setDetected(false);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? "";
      const r = await fetch(`${API}/security-xss-page?name=${encodeURIComponent(n)}`, { headers: { Authorization: token } });
      const html = await r.text();
      setRes(html);
      const lower = n.toLowerCase();
      setDetected(["<script", "onerror", "onload", "javascript:", "alert("].some(p => lower.includes(p)));
    } catch (e: any) { setErr(e?.message || "Request failed"); }
    finally { setBusy(false); setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth" }), 100); }
  };

  return (
    <div style={{ border: "1px solid #fde68a", borderLeft: "3px solid #f59e0b", borderRadius: 8, background: "#fffbeb", overflow: "hidden" }}>
      <ExpandableSection variant="footer" headerText={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, color: "#1e293b", fontWeight: 600 }}>💥 Security Lab: Advanced XSS (DOM-based)</span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", lineHeight: "16px" }}>HIGH</span>
        </span>
      }>
        <div style={{ padding: "16px 20px 20px", color: "#1f2937" }}>
          <SpaceBetween size="l">
            {/* Education */}
            <ColumnLayout columns={2}>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>What is DOM-based XSS?</span>
                <p style={{ margin: "8px 0 0", color: "#374151", lineHeight: 1.6, fontSize: 13 }}>
                  DOM-based XSS occurs when client-side JavaScript reads data from an attacker-controllable
                  source (URL parameters, hash fragments) and writes it into the DOM without sanitization.
                  Unlike reflected XSS, the payload never reaches the server — it executes entirely in the browser.
                </p>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>Why is it dangerous?</span>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#374151", lineHeight: 1.8, fontSize: 13 }}>
                  <li>Bypasses server-side detection entirely</li>
                  <li>Manipulates dashboard data users see</li>
                  <li>Credential harvesting via fake overlays</li>
                  <li>Targeted phishing of high-value users</li>
                </ul>
              </div>
            </ColumnLayout>

            {/* Vulnerable code */}
            <div>
              <span style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>⚠️ Vulnerable Code</span>
              <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "12px 16px", borderRadius: 6, fontSize: 12, lineHeight: 1.6, overflowX: "auto", marginTop: 8 }}>
{`<!-- Server reflects name param directly in HTML -->
<h1>Welcome, {name}</h1>

// Client reads URL hash and injects into DOM
var hash = window.location.hash.substring(1);
document.getElementById('results').innerHTML += hash;`}
              </pre>
            </div>

            {/* Try it yourself */}
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
              <SpaceBetween size="m">
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>🧪 Try It Yourself — Reflected XSS via URL Parameter</span>
                <p style={{ margin: 0, color: "#4b5563", fontSize: 13 }}>
                  Enter a name — it gets reflected in the server's HTML response without encoding.
                  Try injecting HTML/JS to see it rendered in the response.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder='Enter name (try: <script>alert("XSS")</script>)' onKeyDown={({ detail }) => { if (detail.key === "Enter") tryReflected(); }} />
                  </div>
                  <Button variant="primary" onClick={() => tryReflected()} loading={busy}>Render Page</Button>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Sample payloads:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {PAYLOADS.map((p) => (
                      <button key={p.label} onClick={() => { setName(p.value); tryReflected(p.value); }}
                        style={{ background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#1e40af", cursor: "pointer", fontFamily: "monospace" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#e5e7eb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                        title={p.label}>{p.label}</button>
                    ))}
                  </div>
                </div>
              </SpaceBetween>
            </div>

            {/* Results */}
            <div ref={ref}>
              {err && <Alert type="error" header="Request Failed">{err}</Alert>}
              {detected && <Alert type="warning" header="XSS Detected">Your payload contains script injection patterns. In a real browser render, this would execute malicious code.</Alert>}
              {res && (
                <div>
                  <span style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>Server Response (HTML source):</span>
                  <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "12px 16px", borderRadius: 6, fontSize: 12, lineHeight: 1.5, overflowX: "auto", marginTop: 8, maxHeight: 250, overflowY: "auto" }}>
                    {res}
                  </pre>
                </div>
              )}
              {res && (
                <Alert type="info" header="🚨 Reflected XSS via URL Parameter">
                  <SpaceBetween size="s">
                    <div><strong>What Happened:</strong> Your input was reflected directly into the server's HTML response without encoding. The <code>name</code> parameter is interpolated into the page template as-is, so any HTML or JavaScript you inject becomes part of the rendered page.</div>
                    <div><strong>How AWS Security Agent Detects This:</strong> The agent sends crafted payloads in URL parameters and inspects the response body for unencoded script tags, event handlers, and other injection markers. A match confirms the server is reflecting input without sanitization.</div>
                  </SpaceBetween>
                </Alert>
              )}
            </div>
          </SpaceBetween>
        </div>
      </ExpandableSection>
    </div>
  );
};

export default AdvancedXSSLab;
