/**
 * Cross-Site Scripting (XSS) Vulnerability Demo Page
 * WARNING: Intentionally vulnerable for educational purposes.
 */
import {
    Alert, Box, Button, Container, ContentLayout, Header, Input, SpaceBetween,
    Textarea,
} from "@cloudscape-design/components";
import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_REST_API_URL?.replace(/\/$/, "") ?? "";
const PAGE_SIZE = 10;

const XSS_PAYLOADS = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg onload=alert("XSS")>',
    '<iframe src="javascript:alert(\'XSS\')">',
    '<body onload=alert("XSS")>',
    '<input onfocus=alert("XSS") autofocus>',
];

const SecurityCommentsPage = () => {
    const navigate = useNavigate();
    const [commentInput, setCommentInput] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [comments, setComments] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any>(null);
    const [postResult, setPostResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const commentsRef = useRef<HTMLDivElement>(null);

    const loadComments = useCallback(async () => {
        setLoadError(null);
        try {
            const res = await fetch(`${API_BASE}/security-comments`);
            const data = await res.json();
            if (data.success) {
                setComments(data.data || []);
            } else {
                const errMsg = typeof data.error === 'object' ? data.error.message : (data.error || "Failed to load comments");
                setLoadError(errMsg);
            }
        } catch (err: any) {
            console.error("Failed to load comments:", err);
            setLoadError(err?.message || String(err) || "Failed to load comments");
        }
    }, []);

    const postComment = async (overrideContent?: string) => {
        const content = overrideContent ?? commentInput;
        if (!content.trim()) return;
        setLoading(true);
        setPostResult(null);
        try {
            const res = await fetch(`${API_BASE}/security-comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: 1, content }),
            });
            const data = await res.json();
            setPostResult(data);
            if (data.success) {
                setCommentInput("");
                await loadComments();
            }
        } catch (err: any) {
            console.error("Post comment error:", err);
            setPostResult({ success: false, error: err?.message || String(err) || "Failed to post comment" });
        } finally {
            setLoading(false);
        }
    };

    const searchComments = async (override?: string) => {
        const q = override ?? searchInput;
        if (!q.trim()) return;
        setSearchLoading(true);
        setSearchResults(null);
        try {
            const res = await fetch(`${API_BASE}/security-search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ q }),
            });
            const data = await res.json();
            setSearchResults(data);
        } catch (err: any) {
            setSearchResults({ success: false, error: err?.message || "Search failed" });
        } finally {
            setSearchLoading(false);
        }
    };

    return (
        <ContentLayout header={<Header variant="h1" description="Learn how XSS works and how AWS Security Agent detects it">⚡ Cross-Site Scripting (XSS) Vulnerability Demo</Header>}>
            <SpaceBetween size="l">
                <Alert type="warning" header="Educational Purpose Only">
                    This is an intentionally vulnerable endpoint for educational purposes only.
                </Alert>

                <Container header={<Header variant="h2">What is Cross-Site Scripting (XSS)?</Header>}>
                    <SpaceBetween size="m">
                        <Box>XSS is a security vulnerability that allows attackers to inject malicious scripts into web pages viewed by other users. When user input is displayed without proper sanitization, attackers can inject JavaScript that executes in victims' browsers.</Box>
                        <Box variant="h4">Types of XSS</Box>
                        <ul>
                            <li><strong>Stored XSS:</strong> Malicious script is stored in the database and executed when displayed (demonstrated below)</li>
                            <li><strong>Reflected XSS:</strong> Malicious script is reflected from the server in the response (demonstrated in search)</li>
                            <li><strong>DOM-based XSS:</strong> Malicious script manipulates the DOM directly in the browser</li>
                        </ul>

                    </SpaceBetween>
                </Container>

                {/* Stored XSS Demo */}
                <Container header={<Header variant="h2">Try It Yourself: Comment System (Stored XSS)</Header>}>
                    <SpaceBetween size="m">
                        {postResult?.educational && (
                            <Alert type="info" header={`🚨 ${postResult.educational.vulnerability}`}>
                                <SpaceBetween size="s">
                                    <Box><Box variant="strong">What Happened:</Box> {postResult.educational.what_happened}</Box>
                                    <Box><Box variant="strong">How AWS Security Agent Detects This:</Box> {postResult.educational.how_agent_detects}</Box>
                                    <Box><Box variant="strong">Other Payloads to Try:</Box></Box>
                                    <ul>{postResult.educational.sample_payloads?.map((p: string, i: number) => <li key={i}><code>{p}</code></li>)}</ul>
                                </SpaceBetween>
                            </Alert>
                        )}
                        <Box color="text-body-secondary">Post a comment with XSS payloads. The malicious script will be stored and executed when anyone views the comments!</Box>
                        <Textarea value={commentInput} onChange={({ detail }) => setCommentInput(detail.value)} placeholder="Enter your comment (try XSS payloads!)" rows={3} />
                        <Button variant="primary" onClick={() => postComment()} loading={loading}>Post Comment</Button>
                        {postResult && !postResult.success && (
                            <Alert type="error" header="Failed to post comment">{typeof postResult.error === 'object' ? JSON.stringify(postResult.error) : postResult.error}</Alert>
                        )}
                        {postResult && postResult.success && (
                            <Alert type="success" header="Comment posted">
                                {postResult.message || "Comment created successfully"}
                            </Alert>
                        )}

                        <Container header={<Header variant="h3">📝 Sample XSS Payloads</Header>}>
                            <Box color="text-body-secondary" margin={{ bottom: "s" }}>Click any payload below to try it:</Box>
                            <SpaceBetween size="xs">
                                {XSS_PAYLOADS.map((payload) => (
                                    <Button key={payload} variant="inline-link" onClick={() => { setCommentInput(payload); postComment(payload); }}>
                                        <code>{payload}</code>
                                    </Button>
                                ))}
                            </SpaceBetween>
                        </Container>
                    </SpaceBetween>
                </Container>

                {/* Reflected XSS Demo */}
                <Container header={<Header variant="h2">Try It Yourself: Search (Reflected XSS)</Header>}>
                    <SpaceBetween size="m">
                        {searchResults?.educational && (
                            <Alert type="info" header={`🚨 ${searchResults.educational.vulnerability}`}>
                                <SpaceBetween size="s">
                                    <Box><Box variant="strong">What Happened:</Box> {searchResults.educational.what_happened}</Box>
                                    <Box><Box variant="strong">How AWS Security Agent Detects This:</Box> {searchResults.educational.how_agent_detects}</Box>
                                    <Box><Box variant="strong">Other Payloads to Try:</Box></Box>
                                    <ul>{searchResults.educational.sample_payloads?.map((p: string, i: number) => <li key={i}><code>{p}</code></li>)}</ul>
                                </SpaceBetween>
                            </Alert>
                        )}
                        <Box color="text-body-secondary">Search for comments. Your search query will be reflected in the response without sanitization!</Box>
                        <Input value={searchInput} onChange={({ detail }) => setSearchInput(detail.value)} placeholder="Enter search query (try XSS payloads!)" onKeyDown={({ detail }) => { if (detail.key === "Enter") searchComments(); }} />
                        <div><Button variant="primary" onClick={searchComments} loading={searchLoading}>Search</Button></div>

                        {searchResults && (
                            <Container header={<Header variant="h3">Search Results</Header>}>
                                {searchResults.success ? (
                                    <SpaceBetween size="s">
                                        {/* VULNERABILITY: Reflected XSS - rendering search query without encoding */}
                                        <div dangerouslySetInnerHTML={{ __html: `Search results for: <strong>${searchResults.query}</strong>` }} />
                                        {searchResults.data?.length > 0 ? searchResults.data.map((c: any, i: number) => (
                                            <Container key={i}>
                                                <Box variant="strong">{c.username || "Anonymous"}</Box>
                                                {/* VULNERABILITY: Stored XSS - rendering content without encoding */}
                                                <div dangerouslySetInnerHTML={{ __html: c.content }} />
                                            </Container>
                                        )) : <Box color="text-body-secondary">No comments found.</Box>}
                                    </SpaceBetween>
                                ) : <Alert type="error">{typeof searchResults.error === 'object' ? JSON.stringify(searchResults.error) : searchResults.error}</Alert>}
                            </Container>
                        )}
                    </SpaceBetween>
                </Container>

                {/* Comments Display */}
                <div ref={commentsRef}>
                    <Container header={<Header variant="h2" actions={<Button onClick={() => { setCurrentPage(1); loadComments(); }}>Refresh</Button>}>All Comments ({comments.length})</Header>}>
                        <SpaceBetween size="s">
                            {loadError && <Alert type="error" header="Failed to load comments">{loadError}</Alert>}
                            {!loadError && comments.length === 0 ? (
                                <Box color="text-body-secondary">No comments yet. Click Refresh to load comments, or post one above.</Box>
                            ) : (
                                <>
                                    {comments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((comment, i) => (
                                        <Container key={i}>
                                            <SpaceBetween size="xxs">
                                                <Box variant="strong">{comment.username || "Anonymous"} <Box variant="small" display="inline" color="text-body-secondary">{new Date(comment.created_at).toLocaleString()}</Box></Box>
                                                {/* VULNERABILITY: Stored XSS - rendering content without encoding */}
                                                <div dangerouslySetInnerHTML={{ __html: comment.content }} />
                                            </SpaceBetween>
                                        </Container>
                                    ))}
                                    {comments.length > PAGE_SIZE && (
                                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", paddingTop: "8px" }}>
                                            <Button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                                            <Box color="text-body-secondary">Page {currentPage} of {Math.ceil(comments.length / PAGE_SIZE)}</Box>
                                            <Button disabled={currentPage >= Math.ceil(comments.length / PAGE_SIZE)} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </SpaceBetween>
                    </Container>
                </div>

                <Button variant="link" onClick={() => { navigate("/crm/security"); setTimeout(() => document.getElementById("vuln-demos")?.scrollIntoView({ behavior:"smooth" }), 100); }}>← Back to Security Dashboard</Button>
            </SpaceBetween>
        </ContentLayout>
    );
};

export default SecurityCommentsPage;
