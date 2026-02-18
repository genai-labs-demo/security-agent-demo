/**
 * Security Agent Dashboard Page
 *
 * Landing page for the AWS Security Agent demo, replicating the vulnerability
 * testing platform dashboard within the CRM app shell.
 */

import {
    Box,
    Cards,
    Container,
    ContentLayout,
    Header,
    SpaceBetween,
    StatusIndicator,
    Alert,
    ColumnLayout,
    Spinner,
    Link,
    Button,
    Popover,
} from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface HealthCheck {
    label: string;
    status: "success" | "error" | "loading";
    message: string;
}

const VULNERABILITY_DEMOS = [
    {
        id: "sql-injection",
        title: "🔓 SQL Injection",
        description:
            "Discover how unsanitized database queries can allow attackers to bypass authentication and extract sensitive data.",
        href: "/crm/security/profile",
    },
    {
        id: "idor",
        title: "🔑 Insecure Direct Object Reference (IDOR)",
        description:
            "See how sequential user IDs without authorization checks allow complete enumeration of all user data.",
        href: "/crm/security/profile",
    },
    {
        id: "xss",
        title: "⚡ Cross-Site Scripting (XSS)",
        description:
            "Learn about reflected and stored XSS vulnerabilities that allow malicious script injection into web pages.",
        href: "/crm/security/comments",
    },
    {
        id: "xss-advanced",
        title: "⚡ Advanced XSS",
        description:
            "Explore DOM-based and attribute-based XSS vulnerabilities that exploit client-side JavaScript and HTML attributes.",
        href: "/crm/security/xss-advanced",
    },
    {
        id: "command-injection",
        title: "💻 Command Injection",
        description:
            "Explore how unsanitized input to system commands can allow arbitrary code execution on the server.",
        href: "/crm/security/tools",
    },
    {
        id: "mass-assignment",
        title: "📝 Mass Assignment",
        description:
            "See how accepting unvalidated fields in API requests allows attackers to spoof comment authorship and escalate privileges.",
        href: "/crm/security/comments",
    },
];

const SecurityPage = () => {
    const navigate = useNavigate();
    const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
        { label: "Database (RDS)", status: "loading", message: "Checking..." },
        { label: "Authentication (Cognito)", status: "loading", message: "Checking..." },
        { label: "Overall Status", status: "loading", message: "Checking..." },
    ]);

    // Simulate infrastructure health check on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setHealthChecks([
                { label: "Database (RDS)", status: "success", message: "Connected and operational" },
                { label: "Authentication (Cognito)", status: "success", message: "User pool active" },
                { label: "Overall Status", status: "success", message: "All systems operational" },
            ]);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <ContentLayout
            header={
                <Header
                    variant="h1"
                    description="Educational Vulnerability Testing Platform"
                >
                    AWS Security Agent Demo
                </Header>
            }
        >
            <SpaceBetween size="l">
                <Alert
                    type="warning"
                    header="Educational Purpose Only"
                >
                    This is an intentionally vulnerable application for educational purposes only.
                    These demonstrations show how AWS Security Agent detects and reports common
                    security vulnerabilities.
                </Alert>

                <SpaceBetween size="s" direction="horizontal" alignItems="center">
                    <Button
                        variant="primary"
                        iconName="external"
                        onClick={() => window.open("https://app-128b7ba1-4b4a-4d72-8d51-462bd04d2981.securityagent.global.app.aws", "_blank")}
                    >
                        Open AWS Security Agent
                    </Button>
                    <Box
                        padding={{ horizontal: "m", vertical: "xs" }}
                        display="inline-block"
                    >
                        <SpaceBetween size="xxxs">
                            <Box fontSize="body-s" color="text-body-secondary">
                                <Box variant="strong" display="inline">Username:</Box>{" "}
                                ••••••••{" "}
                                <Box display="inline">
                                    <Popover
                                        size="small"
                                        position="top"
                                        triggerType="custom"
                                        dismissButton={false}
                                        content={<StatusIndicator type="success">Copied</StatusIndicator>}
                                    >
                                        <Button
                                            variant="inline-icon"
                                            iconName="copy"
                                            ariaLabel="Copy username"
                                            onClick={() => { navigator.clipboard.writeText("aws_user"); }}
                                        />
                                    </Popover>
                                </Box>
                            </Box>
                            <Box fontSize="body-s" color="text-body-secondary">
                                <Box variant="strong" display="inline">Password:</Box>{" "}
                                ••••••••{" "}
                                <Box display="inline">
                                    <Popover
                                        size="small"
                                        position="top"
                                        triggerType="custom"
                                        dismissButton={false}
                                        content={<StatusIndicator type="success">Copied</StatusIndicator>}
                                    >
                                        <Button
                                            variant="inline-icon"
                                            iconName="copy"
                                            ariaLabel="Copy password"
                                            onClick={() => { navigator.clipboard.writeText("AWS123xyz!"); }}
                                        />
                                    </Popover>
                                </Box>
                            </Box>
                        </SpaceBetween>
                    </Box>
                </SpaceBetween>

                <Container header={<Header variant="h2">Getting Started with AWS Security Agent</Header>}>
                    <SpaceBetween size="s">
                        <Box><Box variant="strong">Step 1:</Box> Click "Open AWS Security Agent" above and log in with the provided credentials. This takes you to the Security Agent console.</Box>
                        <Box><Box variant="strong">Step 2:</Box> Navigate to <Box variant="strong" display="inline">Agent Space</Box> from the left sidebar. Here you can create a new agent or select an existing one. Within an agent, you'll find tabs for <Box variant="strong" display="inline">Design Review</Box>, <Box variant="strong" display="inline">Code Review</Box>, and <Box variant="strong" display="inline">Pen Test</Box>.</Box>
                        <Box><Box variant="strong">Step 3:</Box> Select <Box variant="strong" display="inline">Pen Test</Box> to run the security agent against this application's intentionally vulnerable endpoints. The agent will automatically detect the SQL injection, XSS, and command injection vulnerabilities demonstrated below.</Box>
                    </SpaceBetween>
                </Container>

                <Container header={<Header variant="h2">Infrastructure Status</Header>}>
                    <ColumnLayout columns={3} variant="text-grid">
                        {healthChecks.map((check) => (
                            <SpaceBetween key={check.label} size="xxs">
                                <Box variant="awsui-key-label">{check.label}</Box>
                                {check.status === "loading" ? (
                                    <Spinner size="normal" />
                                ) : (
                                    <StatusIndicator type={check.status}>
                                        {check.message}
                                    </StatusIndicator>
                                )}
                            </SpaceBetween>
                        ))}
                    </ColumnLayout>
                </Container>

                <Container
                    header={
                        <Header
                            variant="h2"
                            description="Explore these intentional security vulnerabilities to learn how AWS Security Agent detects and reports them."
                        >
                            Vulnerability Demonstrations
                        </Header>
                    }
                >
                    <Cards
                        cardDefinition={{
                            header: (item) => (
                                <Link
                                    fontSize="heading-m"
                                    onFollow={(e) => { e.preventDefault(); navigate(item.href); }}
                                    href={item.href}
                                >
                                    {item.title}
                                </Link>
                            ),
                            sections: [
                                {
                                    id: "description",
                                    content: (item) => item.description,
                                },
                            ],
                        }}
                        items={VULNERABILITY_DEMOS}
                        cardsPerRow={[
                            { cards: 1 },
                            { minWidth: 400, cards: 2 },
                        ]}
                    />
                </Container>
            </SpaceBetween>
        </ContentLayout>
    );
};

export default SecurityPage;
