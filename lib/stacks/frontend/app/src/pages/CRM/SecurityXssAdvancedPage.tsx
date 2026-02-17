/**
 * Advanced XSS Vulnerabilities Demo Page
 * DOM-based and Attribute-based XSS attacks (client-side only).
 * WARNING: Intentionally vulnerable for educational purposes.
 */
import {
    Alert, Box, Button, Container, ContentLayout, Header, Input, SpaceBetween,
} from "@cloudscape-design/components";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const DOM_PAYLOADS = ['<img src=x onerror=alert("DOM-XSS")>', '<svg onload=alert("DOM-XSS")>', '<iframe src="javascript:alert(\'DOM-XSS\')">', '<body onload=alert("DOM-XSS")>'];
const ATTR_PAYLOADS = ["javascript:alert('Attr-XSS')", "javascript:void(alert('Attr-XSS'))", '" onmouseover="alert(\'Attr-XSS\')', "' onclick='alert(\"Attr-XSS\")"];
const EVENT_PAYLOADS = ['x" onerror="alert(\'Event-XSS\')', 'x\' onerror=\'alert("Event-XSS")\'', 'invalid-url" onload="alert(\'Event-XSS\')'];

const XSS_PATTERNS = [/<script/i, /javascript:/i, /onerror=/i, /onload=/i, /onclick=/i, /onmouseover=/i, /<iframe/i, /<svg/i, /<img/i, /<body/i];
const detectXSS = (input: string) => XSS_PATTERNS.some((p) => p.test(input));

interface EduInfo { title: string; whatHappened: string; howDetects: string; }

const EDU: Record<string, EduInfo> = {
    dom: {
        title: "DOM-based XSS Detected!",
        whatHappened: "Your input was placed directly into the DOM using innerHTML without sanitization. The browser parsed your input as HTML, allowing any script tags or event handlers to execute.",
        howDetects: "AWS Security Agent detects DOM-based XSS by analyzing client-side JavaScript code for dangerous DOM manipulation patterns (innerHTML, document.write, eval) that use untrusted data sources.",
    },
    attribute: {
        title: "Attribute-based XSS Detected!",
        whatHappened: "Your input was placed directly into an HTML attribute (href) without validation. By using javascript: protocol or breaking out of the attribute with quotes, you can execute arbitrary JavaScript.",
        howDetects: "AWS Security Agent detects attribute-based XSS by testing various attribute injection techniques, including javascript: protocol handlers and attribute breakout attempts.",
    },
    event: {
        title: "Event Handler Injection Detected!",
        whatHappened: "Your input was placed into an HTML attribute where you could inject event handlers like onerror or onload. By breaking out of the src attribute, you can execute JavaScript when the event fires.",
        howDetects: "AWS Security Agent detects event handler injection by testing payloads that break out of attributes and inject event handlers (onerror, onload, onclick, etc.).",
    },
};

const SecurityXssAdvancedPage = () => {
    const navigate = useNavigate();
    const [nameInput, setNameInput] = useState("");
    const [linkInput, setLinkInput] = useState("https://example.com");
    const [imageInput, setImageInput] = useState("https://via.placeholder.com/150");
    const [eduMessage, setEduMessage] = useState<EduInfo | null>(null);
    const greetingRef = useRef<HTMLDivElement>(null);
    const linkRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLDivElement>(null);

    const updateGreeting = (val?: string) => {
        const name = val ?? nameInput;
        if (!name.trim() || !greetingRef.current) return;
        // VULNERABILITY: DOM-based XSS - using innerHTML with user input
        greetingRef.current.innerHTML = `<p style="font-size:18px;">Hello, ${name}! Welcome to the demo.</p>`;
        if (detectXSS(name)) setEduMessage(EDU.dom);
    };

    const createLink = (val?: string) => {
        const url = val ?? linkInput;
        if (!url.trim() || !linkRef.current) return;
        // VULNERABILITY: Attribute-based XSS - placing user input in href
        linkRef.current.innerHTML = `<p style="margin-bottom:8px;">Click the link below:</p><a href="${url}" style="color:#539fe5;font-size:16px;text-decoration:underline;">Click here to visit</a>`;
        if (detectXSS(url) || url.toLowerCase().startsWith("javascript:")) setEduMessage(EDU.attribute);
    };

    const displayImage = (val?: string) => {
        const url = val ?? imageInput;
        if (!url.trim() || !imageRef.current) return;
        // VULNERABILITY: Event handler injection - placing user input in src attribute
        imageRef.current.innerHTML = `<p style="margin-bottom:8px;">Image preview:</p><img src="${url}" alt="User provided image" style="max-width:100%;border-radius:6px;">`;
        if (detectXSS(url)) setEduMessage(EDU.event);
    };

    return (
        <ContentLayout header={<Header variant="h1" description="DOM-based and Attribute-based XSS attacks">⚡ Advanced XSS Vulnerabilities Demo</Header>}>
            <SpaceBetween size="l">
                <Alert type="warning" header="Educational Purpose Only">This is an intentionally vulnerable page for educational purposes only.</Alert>

                <Container header={<Header variant="h2">What are DOM-based and Attribute-based XSS?</Header>}>
                    <SpaceBetween size="m">
                        <ul>
                            <li><strong>DOM-based XSS:</strong> The vulnerability exists in client-side JavaScript that manipulates the DOM using untrusted data without proper validation.</li>
                            <li><strong>Attribute-based XSS:</strong> Malicious code is injected into HTML attributes (href, src, event handlers) allowing script execution.</li>
                        </ul>
                        <pre style={{ background: "rgba(255,255,255,0.05)", padding: "15px", borderRadius: "6px", fontSize: "13px", overflow: "auto" }}>{`// ❌ VULNERABLE
document.getElementById('greeting').innerHTML = 'Hello ' + name;

// ✅ SECURE
document.getElementById('greeting').textContent = 'Hello ' + name;`}</pre>
                    </SpaceBetween>
                </Container>

                {/* DOM-based XSS */}
                <Container header={<Header variant="h2">Try It Yourself: DOM-based XSS</Header>}>
                    <SpaceBetween size="m">
                        <Box color="text-body-secondary">Enter your name. The JavaScript will manipulate the DOM directly without server interaction!</Box>
                        <Input value={nameInput} onChange={({ detail }) => setNameInput(detail.value)} placeholder="Enter your name (try XSS payloads!)" onKeyDown={({ detail }) => { if (detail.key === "Enter") updateGreeting(); }} />
                        <Button variant="primary" onClick={() => updateGreeting()}>Update Greeting</Button>
                        <Container header={<Header variant="h3">Greeting</Header>}><div ref={greetingRef}><Box color="text-body-secondary">Enter your name above to see a greeting</Box></div></Container>
                        <Container header={<Header variant="h3">📝 Sample DOM-based XSS Payloads</Header>}>
                            <SpaceBetween size="xs">
                                {DOM_PAYLOADS.map((p) => (<Button key={p} variant="inline-link" onClick={() => { setNameInput(p); updateGreeting(p); }}><code>{p}</code></Button>))}
                            </SpaceBetween>
                        </Container>
                    </SpaceBetween>
                </Container>

                {/* Attribute-based XSS */}
                <Container header={<Header variant="h2">Try It Yourself: Attribute-based XSS</Header>}>
                    <SpaceBetween size="m">
                        <Box color="text-body-secondary">Enter a URL or JavaScript code. The input will be placed directly into HTML attributes without validation!</Box>
                        <Input value={linkInput} onChange={({ detail }) => setLinkInput(detail.value)} placeholder="Enter a URL (try javascript: payloads!)" onKeyDown={({ detail }) => { if (detail.key === "Enter") createLink(); }} />
                        <Button variant="primary" onClick={() => createLink()}>Create Link</Button>
                        <Container header={<Header variant="h3">Generated Link</Header>}><div ref={linkRef}><Box color="text-body-secondary">Enter a URL above to create a link</Box></div></Container>
                        <Container header={<Header variant="h3">📝 Sample Attribute-based XSS Payloads</Header>}>
                            <SpaceBetween size="xs">
                                {ATTR_PAYLOADS.map((p) => (<Button key={p} variant="inline-link" onClick={() => { setLinkInput(p); createLink(p); }}><code>{p}</code></Button>))}
                            </SpaceBetween>
                        </Container>
                    </SpaceBetween>
                </Container>

                {/* Event Handler Injection */}
                <Container header={<Header variant="h2">Try It Yourself: Event Handler Injection</Header>}>
                    <SpaceBetween size="m">
                        <Box color="text-body-secondary">Enter an image URL. The input will be placed in an img tag's src attribute, allowing onerror event injection!</Box>
                        <Input value={imageInput} onChange={({ detail }) => setImageInput(detail.value)} placeholder="Enter image URL (try onerror payloads!)" onKeyDown={({ detail }) => { if (detail.key === "Enter") displayImage(); }} />
                        <Button variant="primary" onClick={() => displayImage()}>Display Image</Button>
                        <Container header={<Header variant="h3">Image Preview</Header>}><div ref={imageRef}><Box color="text-body-secondary">Enter an image URL above to display it</Box></div></Container>
                        <Container header={<Header variant="h3">📝 Sample Event Handler Injection Payloads</Header>}>
                            <SpaceBetween size="xs">
                                {EVENT_PAYLOADS.map((p) => (<Button key={p} variant="inline-link" onClick={() => { setImageInput(p); displayImage(p); }}><code>{p}</code></Button>))}
                            </SpaceBetween>
                        </Container>
                    </SpaceBetween>
                </Container>

                {eduMessage && (
                    <Alert type="info" header={`🚨 ${eduMessage.title}`}>
                        <SpaceBetween size="s">
                            <Box><Box variant="strong">What Happened:</Box> {eduMessage.whatHappened}</Box>
                            <Box><Box variant="strong">How AWS Security Agent Detects This:</Box> {eduMessage.howDetects}</Box>
                        </SpaceBetween>
                    </Alert>
                )}

                <Button variant="link" onClick={() => navigate("/crm/security")}>← Back to Security Dashboard</Button>
            </SpaceBetween>
        </ContentLayout>
    );
};

export default SecurityXssAdvancedPage;
