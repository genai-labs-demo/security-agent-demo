/**
 * SQL Injection Security Lab — inline on the Accounts page.
 * Collapsed by default; expands to show education + try-it-yourself.
 */
import { useState, useRef, CSSProperties } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Box, Button, ColumnLayout, ExpandableSection,
  Input, SpaceBetween, Spinner, StatusIndicator, Alert,
} from "@cloudscape-design/components";

const API = import.meta.env.VITE_REST_API_URL?.replace(/\/$/, "") ?? "";

const PAYLOADS = [
  { label: "Basic OR bypass", value: "1' OR '1'='1" },
  { label: "Comment termination", value: "1' OR '1'='1' --" },
  { label: "Admin bypass", value: "admin' --" },
  { label: "UNION extraction", value: "1' UNION SELECT id, username, email, role, bio, created_at FROM security_users --" },
];

const pill = (role: string): CSSProperties => ({
  display: "inline-block", fontSize: 11, fontWeight: 600,
  padding: "2px 10px", borderRadius: 12,
  background: role === "admin" ? "#fef2f2" : "#eef2ff",
  color: role === "admin" ? "#dc2626" : "#4f46e5",
  border: `1px solid ${role === "admin" ? "#fecaca" : "#c7d2fe"}`,
});

const SQLInjectionLab = () => {
  const [uid, setUid] = useState("1");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const search = async (v?: string) => {
    const id = v ?? uid;    if (!id.trim()) return;
    setBusy(true); setErr(null); setRes(null);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? "";
      const r = await fetch(`${API}/security-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ user_id: id }),
      });
      setRes(await r.json());
    } catch (e: any) { setErr(e?.message || "Request failed"); }
    finally { setBusy(false); setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth" }), 100); }
  };

  return (
    <div style={{ border: "1px solid #fecaca", borderLeft: "3px solid #ef4444", borderRadius: 8, background: "#fef2f2", overflow: "hidden" }}>
      <ExpandableSection variant="footer" headerText={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, color: "#1e293b", fontWeight: 600 }}>🔓 Security Lab: SQL Injection</span>
          <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", lineHeight: "16px" }}>CRITICAL</span>
        </span>
      }>
        <div style={{ padding: "16px 20px 20px", color: "#1f2937" }}>
          <SpaceBetween size="l">
            {/* Education */}
            <ColumnLayout columns={2}>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>What is SQL Injection?</span>
                <p style={{ margin: "8px 0 0", color: "#374151", lineHeight: 1.6, fontSize: 13 }}>
                  SQL Injection exploits vulnerabilities in an application's database layer. When user input is
                  directly concatenated into SQL queries without parameterization, attackers can inject malicious SQL.
                </p>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>Why is it dangerous?</span>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#374151", lineHeight: 1.8, fontSize: 13 }}>
                  <li>Authentication bypass</li>
                  <li>Unauthorized data access</li>
                  <li>Data manipulation or deletion</li>
                  <li>Complete database compromise</li>
                </ul>
              </div>
            </ColumnLayout>

            {/* Vulnerable code */}
            <div>
              <span style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>⚠️ Vulnerable Code</span>
              <pre style={{ background: "#1e293b", color: "#e2e8f0", padding: "12px 16px", borderRadius: 6, fontSize: 12, lineHeight: 1.6, overflowX: "auto", marginTop: 8 }}>
{`query = f"SELECT * FROM users WHERE id = '{user_input}'"
# user_input is NOT sanitized — attacker can break out`}
              </pre>
            </div>

            {/* Try it yourself */}
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
              <SpaceBetween size="m">
                <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>🧪 Try It Yourself</span>
                <p style={{ margin: 0, color: "#4b5563", fontSize: 13 }}>Enter a user ID to search. Try SQL injection payloads to manipulate the query.</p>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <Input value={uid} onChange={({ detail }) => setUid(detail.value)} placeholder="Enter user ID (e.g. 1)" onKeyDown={({ detail }) => { if (detail.key === "Enter") search(); }} />
                  </div>
                  <Button variant="primary" onClick={() => search()} loading={busy}>Search</Button>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Sample payloads:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {PAYLOADS.map((p) => (
                      <button key={p.value} onClick={() => { setUid(p.value); search(p.value); }}
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
              {busy && <div style={{ textAlign: "center", padding: 16 }}><Spinner size="large" /> <span style={{ color: "#374151" }}>Searching…</span></div>}
              {err && <Alert type="error" header="Request Failed">{err}</Alert>}
              {res && (
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  {res.success ? (
                    <SpaceBetween size="s">
                      {res.message && <div style={{ padding: "8px 12px" }}><Alert type="warning">{res.message}</Alert></div>}
                      {Array.isArray(res.data) ? (
                        <>
                          <div style={{ padding: "8px 12px 0" }}>
                            <StatusIndicator type="warning">Found {res.data.length} users (SQL injection detected!)</StatusIndicator>
                          </div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                                  {["ID", "Username", "Email", "Role"].map((h) => (
                                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#111827" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {res.data.map((u: any, i: number) => (
                                  <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                                    <td style={{ padding: "10px 12px", color: "#374151" }}>{u.id}</td>
                                    <td style={{ padding: "10px 12px", color: "#111827", fontWeight: 500 }}>{u.username}</td>
                                    <td style={{ padding: "10px 12px", color: "#374151" }}>{u.email}</td>
                                    <td style={{ padding: "10px 12px" }}><span style={pill(u.role)}>{u.role}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : res.data ? (
                        <div style={{ padding: 12 }}>
                          <ColumnLayout columns={2} variant="text-grid">
                            <SpaceBetween size="xxs"><Box variant="awsui-key-label">Username</Box><Box>{res.data.username}</Box></SpaceBetween>
                            <SpaceBetween size="xxs"><Box variant="awsui-key-label">Email</Box><Box>{res.data.email}</Box></SpaceBetween>
                            <SpaceBetween size="xxs"><Box variant="awsui-key-label">Role</Box><Box>{res.data.role}</Box></SpaceBetween>
                            <SpaceBetween size="xxs"><Box variant="awsui-key-label">Bio</Box><Box>{res.data.bio || "N/A"}</Box></SpaceBetween>
                          </ColumnLayout>
                        </div>
                      ) : null}
                    </SpaceBetween>
                  ) : (
                    <div style={{ padding: 12 }}>
                      <Alert type="error" header="Error">
                        {typeof res.error === "object" ? res.error.message || JSON.stringify(res.error) : res.error}
                      </Alert>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Educational alert from API */}
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

export default SQLInjectionLab;
