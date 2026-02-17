/**
 * SQL Injection Vulnerability Demo Page
 * WARNING: This page demonstrates intentional SQL injection vulnerabilities for educational purposes.
 */
import {
    Alert, Box, Button, Container, ContentLayout, Header, Input, SpaceBetween,
    ColumnLayout, StatusIndicator, Spinner,
} from "@cloudscape-design/components";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "aws-amplify/api";

const SAMPLE_PAYLOADS = [
    "1 OR 1=1",
    "1' OR '1'='1",
    "admin' --",
    "1' UNION SELECT * FROM security_users --",
];

const SecurityProfilePage = () => {
    const navigate = useNavigate();
    const [userId, setUserId] = useState("1");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const resultRef = useRef<HTMLDivElement>(null);

    const searchProfile = async (input?: string) => {
        const searchId = input ?? userId;
        if (!searchId.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const restOp = post({ apiName: "restApi", path: "/security-profile", options: { body: { user_id: searchId } as any } });
            const response = await restOp.response;
            const data = await response.body.json() as any;
            setResult(data);
        } catch (err: any) {
            setError(err?.message || "Request failed");
        } finally {
            setLoading(false);
            setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
    };

    return (
        <ContentLayout header={<Header variant="h1" description="Learn how SQL injection works and how AWS Security Agent detects it">🔓 SQL Injection Vulnerability Demo</Header>}>
            <SpaceBetween size="l">
                <Alert type="warning" header="Educational Purpose Only">
                    This is an intentionally vulnerable endpoint for educational purposes only.
                </Alert>

                <Container header={<Header variant="h2">What is SQL Injection?</Header>}>
                    <SpaceBetween size="m">
                        <Box>SQL Injection is a code injection technique that exploits security vulnerabilities in an application's database layer. When user input is directly concatenated into SQL queries without proper parameterization, attackers can inject malicious SQL code to bypass authentication, extract sensitive data, or modify database contents.</Box>
                        <Box variant="h4">Why It's Dangerous</Box>
                        <Box>Authentication bypass, unauthorized data access, data manipulation, and complete database compromise.</Box>
                        <Box variant="h4">How to Fix It</Box>
                        <pre style={{ background: "rgba(255,255,255,0.05)", padding: "15px", borderRadius: "6px", fontSize: "13px", overflow: "auto" }}>{`// ❌ VULNERABLE (string concatenation)
const query = \`SELECT * FROM users WHERE id = \${userId}\`;

// ✅ SECURE (parameterized query)
const query = 'SELECT * FROM users WHERE id = $1';
pool.query(query, [userId]);`}</pre>
                    </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Try It Yourself: User Profile Search</Header>}>
                    <SpaceBetween size="m">
                        <Box color="text-body-secondary">Enter a user ID to search for a profile. Try using SQL injection payloads to manipulate the query!</Box>
                        <Input value={userId} onChange={({ detail }) => setUserId(detail.value)} placeholder="Enter user ID (e.g., 1 or try: 1 OR 1=1)" onKeyDown={({ detail }) => { if (detail.key === "Enter") searchProfile(); }} />
                        <Button variant="primary" onClick={() => searchProfile()} loading={loading}>Search Profile</Button>

                        <Container header={<Header variant="h3">📝 Sample SQL Injection Payloads</Header>}>
                            <Box color="text-body-secondary" margin={{ bottom: "s" }}>Click any payload below to try it:</Box>
                            <SpaceBetween size="xs">
                                {SAMPLE_PAYLOADS.map((payload) => (
                                    <Button key={payload} variant="inline-link" onClick={() => { setUserId(payload); searchProfile(payload); }}>
                                        <code>{payload}</code>
                                    </Button>
                                ))}
                            </SpaceBetween>
                        </Container>
                    </SpaceBetween>
                </Container>

                <div ref={resultRef}>
                    {loading && <Container><Spinner size="large" /> Searching...</Container>}

                    {error && <Alert type="error" header="Request Failed">{error}</Alert>}

                    {result && (
                        <Container header={<Header variant="h2">Results</Header>}>
                            {result.success ? (
                                <SpaceBetween size="m">
                                    {result.message && <Alert type="warning">{result.message}</Alert>}
                                    {Array.isArray(result.data) ? (
                                        <>
                                            <StatusIndicator type="warning">Found {result.data.length} users (SQL injection detected!)</StatusIndicator>
                                            {result.data.map((user: any, i: number) => (
                                                <Container key={i}>
                                                    <ColumnLayout columns={2} variant="text-grid">
                                                        <SpaceBetween size="xxs"><Box variant="awsui-key-label">Username</Box><Box>{user.username}</Box></SpaceBetween>
                                                        <SpaceBetween size="xxs"><Box variant="awsui-key-label">Email</Box><Box>{user.email}</Box></SpaceBetween>
                                                        <SpaceBetween size="xxs"><Box variant="awsui-key-label">Role</Box><Box>{user.role}</Box></SpaceBetween>
                                                        <SpaceBetween size="xxs"><Box variant="awsui-key-label">ID</Box><Box>{user.id}</Box></SpaceBetween>
                                                    </ColumnLayout>
                                                </Container>
                                            ))}
                                        </>
                                    ) : result.data ? (
                                        <Container>
                                            <ColumnLayout columns={2} variant="text-grid">
                                                <SpaceBetween size="xxs"><Box variant="awsui-key-label">Username</Box><Box>{result.data.username}</Box></SpaceBetween>
                                                <SpaceBetween size="xxs"><Box variant="awsui-key-label">Email</Box><Box>{result.data.email}</Box></SpaceBetween>
                                                <SpaceBetween size="xxs"><Box variant="awsui-key-label">Role</Box><Box>{result.data.role}</Box></SpaceBetween>
                                                <SpaceBetween size="xxs"><Box variant="awsui-key-label">Bio</Box><Box>{result.data.bio || "N/A"}</Box></SpaceBetween>
                                            </ColumnLayout>
                                        </Container>
                                    ) : null}
                                </SpaceBetween>
                            ) : (
                                <Alert type="error" header="Error">
                                    {result.error}{result.message && <><br />{result.message}</>}
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

export default SecurityProfilePage;
