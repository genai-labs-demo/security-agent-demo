/**
 * Command Injection Vulnerability Demo Page
 * WARNING: Intentionally vulnerable for educational purposes.
 */
import {
    Alert, Box, Button, Container, ContentLayout, Header, Input, SpaceBetween,
    Spinner,
} from "@cloudscape-design/components";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_REST_API_URL?.replace(/\/$/, "") ?? "";

const SAMPLE_PAYLOADS = [
    "google.com; ls -la",
    "google.com | whoami",
    "google.com && cat /etc/passwd",
    "google.com; pwd",
    "google.com; uname -a",
    "google.com `id`",
];

const SecurityToolsPage = () => {
    const navigate = useNavigate();
    const [hostInput, setHostInput] = useState("google.com");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const resultRef = useRef<HTMLDivElement>(null);

    const executePing = async (input?: string) => {
        const host = input ?? hostInput;
        if (!host.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch(`${API_BASE}/security-tools/ping`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ host }),
            });
            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setError(err?.message || "Request failed");
        } finally {
            setLoading(false);
            setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
    };

    return (
        <ContentLayout header={<Header variant="h1" description="Learn how command injection works and how AWS Security Agent detects it">💻 Command Injection Vulnerability Demo</Header>}>
            <SpaceBetween size="l">
                <Alert type="warning" header="Educational Purpose Only">
                    This is an intentionally vulnerable endpoint for educational purposes only.
                </Alert>

                <Container header={<Header variant="h2">What is Command Injection?</Header>}>
                    <SpaceBetween size="m">
                        <Box>Command Injection allows attackers to execute arbitrary operating system commands on the server. When user input is passed directly to system command execution functions without sanitization, attackers can inject additional commands using shell metacharacters.</Box>
                        <Box variant="h4">Why It's Dangerous</Box>
                        <Box>Complete server compromise, data exfiltration, system manipulation, lateral movement, and denial of service.</Box>
                        <Box variant="h4">How to Fix It</Box>
                        <pre style={{ background: "rgba(255,255,255,0.05)", padding: "15px", borderRadius: "6px", fontSize: "13px", overflow: "auto" }}>{`# ❌ VULNERABLE (shell command with user input)
command = f"ping -c 4 {user_input}"
subprocess.run(command, shell=True)

# ✅ SECURE (use subprocess without shell)
subprocess.run(["ping", "-c", "4", user_input], shell=False)`}</pre>
                    </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Try It Yourself: Network Ping Tool</Header>}>
                    <SpaceBetween size="m">
                        <Box color="text-body-secondary">Enter a hostname or IP address to ping. Try using command injection payloads to execute additional commands on the server!</Box>
                        <Input value={hostInput} onChange={({ detail }) => setHostInput(detail.value)} placeholder="Enter hostname or IP (e.g., google.com or try: google.com; ls)" onKeyDown={({ detail }) => { if (detail.key === "Enter") executePing(); }} />
                        <Button variant="primary" onClick={() => executePing()} loading={loading}>Execute Ping</Button>

                        <Container header={<Header variant="h3">📝 Sample Command Injection Payloads</Header>}>
                            <Box color="text-body-secondary" margin={{ bottom: "s" }}>Click any payload below to try it:</Box>
                            <SpaceBetween size="xs">
                                {SAMPLE_PAYLOADS.map((payload) => (
                                    <Button key={payload} variant="inline-link" onClick={() => { setHostInput(payload); executePing(payload); }}>
                                        <code>{payload}</code>
                                    </Button>
                                ))}
                            </SpaceBetween>
                        </Container>
                    </SpaceBetween>
                </Container>

                <div ref={resultRef}>
                    {loading && <Container><Spinner size="large" /> Executing ping command...</Container>}

                    {error && <Alert type="error" header="Request Failed">{error}</Alert>}

                    {result && (
                        <Container header={<Header variant="h2">Command Output</Header>}>
                            {result.success ? (
                                <SpaceBetween size="m">
                                    {result.educational && (
                                        <Alert type="warning">
                                            <strong>⚠️ Command Injection Detected!</strong>
                                            <Box margin={{ top: "xs" }}>The output below shows that additional commands were executed beyond the intended ping command.</Box>
                                        </Alert>
                                    )}
                                    {result.output && (
                                        <Box>
                                            <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word", fontFamily: "'Courier New', monospace", fontSize: "13px", background: "rgba(255,255,255,0.05)", padding: "15px", borderRadius: "6px" }}>
                                                {result.output}
                                            </pre>
                                        </Box>
                                    )}
                                </SpaceBetween>
                            ) : (
                                <Alert type="error" header="Error">
                                    {result.error}{result.message && <><br />{result.message}</>}
                                    {result.output && <pre style={{ marginTop: "10px", fontSize: "12px" }}>{result.output}</pre>}
                                </Alert>
                            )}
                        </Container>
                    )}

                    {result?.educational && (
                        <Alert type="info" header={`🚨 ${result.educational.vulnerability}`}>
                            <SpaceBetween size="s">
                                <Box><Box variant="strong">What Happened:</Box> {result.educational.what_happened}</Box>
                                <Box><Box variant="strong">How AWS Security Agent Detects This:</Box> {result.educational.how_agent_detects}</Box>
                                <Box><Box variant="strong">Other Payloads to Try:</Box></Box>
                                <ul>{result.educational.sample_payloads?.map((p: string, i: number) => <li key={i}><code>{p}</code></li>)}</ul>
                            </SpaceBetween>
                        </Alert>
                    )}
                </div>

                <Button variant="link" onClick={() => navigate("/crm/security")}>← Back to Security Dashboard</Button>
            </SpaceBetween>
        </ContentLayout>
    );
};

export default SecurityToolsPage;
