/**
 * Command Injection Security Lab — inline on the Team Performance page.
 * Collapsed by default; expands to show education + try-it-yourself.
 */
import { useState, useRef } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Box, Button, ColumnLayout, ExpandableSection,
  Input, SpaceBetween, Spinner, Alert,
} from "@cloudscape-design/components";

const API = import.meta.env.VITE_REST_API_URL?.replace(/\/$/, "") ?? "";

const PAYLOADS = [
  { label: "List files", value: "google.com; ls -la" },
  { label: "Current user", value: "google.com | whoami" },
  { label: "System info", value: "google.com; uname -a" },
  { label: "Read passwd", value: "google.com; cat /etc/passwd" },
  { label: "Environment", value: "google.com; env" },
  { label: "Process ID", value: "google.com; id" },
];

const CommandInjectionLab = () => {
  const [host, setHost] = useState("google.com");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const execute = async (v?: string) => {
    const h = v ?? host;
    if (!h.trim()) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? "";
      const r = await fetch(`${API}/security-tools/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ host: h }),
      });
      setRes(await r.json());
    } catch (e: any) { setErr(e?.message || "Request failed"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ border: "1px solid #fecaca", borderLeft: "3px solid #ef4444", borderRadius: 8, background: "#fef2f2", overflow: "hidden" }}>
      <ExpandableSection variant="footer" headerText={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, color: "#1e293b", fontWeight: 600 }}>💻 Security Lab: Command Injection</span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", lineHeight: "16px" }}>CRITICAL</span>
        </span>
      }>
        <div style={{ padding: "16px 20px 20px", color: "#1f2937" }}>
          <SpaceBetween size="l">
            {/* Education */}
            <ColumnLayout columns={2}>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>What is Command Injection?</span>
                <p style={{ margin: "8px 0 0", color: "#374151", lineHeight: 1.6, fontSize: 13 }}>
                  Command Injection allows attackers to execute arbitrary OS commands on the server.
                  When user input is passed to system command functions (like <code>subprocess</code>) without
                  sanitization, shell metacharacters (<code>;</code> <code>|</code> <code>&amp;&amp;</code>) let attackers chain additional commands.
                </p>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>Why is it dangerous?</span>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#374151", lineHeight: 1.8, fontSize: 13 }}>
                  <li>Complete server compromise</li>
                  <li>Database credential exfiltration</li>
                  <li>Lateral movement to other AWS resources</li>
                  <li>Data exfiltration and backdoor installation</li>
                </ul>
              </div>
            </ColumnLayout>

            {/* Vulnerable code */}
            <div>
              <span style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>⚠️ Vulnerable Code</span>
              <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "12px 16px", borderRadius: 6, fontSize: 12, lineHeight: 1.6, overflowX: "auto", marginTop: 8 }}>
{`command = f"nslookup {host}"
result = subprocess.run(command, shell=True, ...)
# host is NOT sanitized — attacker can chain commands with ; | &&`}
              </pre>
            </div>

            {/* Try it yourself */}
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
              <SpaceBetween size="m">
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>🧪 Try It Yourself — Network Lookup</span>
                <p style={{ margin: 0, color: "#4b5563", fontSize: 13 }}>Enter a hostname for DNS lookup. Try injecting shell commands using <code>;</code> or <code>|</code> to execute arbitrary commands.</p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Input value={host} onChange={({ detail }) => setHost(detail.value)} placeholder="Enter hostname (e.g. google.com; whoami)" onKeyDown={({ detail }) => { if (detail.key === "Enter") execute(); }} />
                  </div>
                  <Button variant="primary" onClick={() => execute()} loading={busy}>Execute</Button>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Sample payloads:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {PAYLOADS.map((p) => (
                      <button key={p.label} onClick={() => { setHost(p.value); execute(p.value); }}
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
              {busy && <div style={{ textAlign: "center", padding: 16 }}><Spinner size="large" /> <span style={{ color: "#374151" }}>Executing…</span></div>}
              {err && <Alert type="error" header="Request Failed">{err}</Alert>}
              {res && (
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  {res.message && <div style={{ padding: "8px 12px" }}><Alert type="warning">{res.message}</Alert></div>}
                  {res.output && (
                    <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "12px 16px", margin: 0, fontSize: 12, lineHeight: 1.5, overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
                      {res.output}
                    </pre>
                  )}
                  {res.error && !res.output && (
                    <div style={{ padding: 12 }}><Alert type="error" header="Error">{typeof res.error === "object" ? JSON.stringify(res.error) : res.error}</Alert></div>
                  )}
                </div>
              )}
            </div>

            {/* Educational alert */}
            {res?.educational && (
              <Alert type="info" header={`🚨 ${res.educational.vulnerability}`}>
                <SpaceBetween size="s">
                  <Box><Box variant="strong">What Happened:</Box> {res.educational.what_happened}</Box>
                  <Box><Box variant="strong">How AWS Security Agent Detects This:</Box> {res.educational.how_agent_detects}</Box>
                </SpaceBetween>
              </Alert>
            )}
          </SpaceBetween>
        </div>
      </ExpandableSection>
    </div>
  );
};

export default CommandInjectionLab;
