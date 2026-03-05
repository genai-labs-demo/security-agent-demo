import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import architectureOverviewMd from "./docs/architecture-overview.md?raw";
import dataFlowMd from "./docs/data-flow.md?raw";
import securityControlsMd from "./docs/security-controls.md?raw";
import threatModelMd from "./docs/threat-model.md?raw";

interface DocMeta {
    title: string;
    description: string;
    badge: string;
    color: string;
    icon: string;
    content: string;
}

const DOCUMENTS: Record<string, DocMeta> = {
    "architecture-overview": {
        title: "Architecture Overview",
        description: "System architecture, technology stack, network layout, and API endpoints",
        badge: "Architecture",
        color: "#0972d3",
        icon: "🏗️",
        content: architectureOverviewMd,
    },
    "data-flow": {
        title: "Data Flow",
        description: "Authentication flows, data operations, credential storage, and asset delivery",
        badge: "Data Flow",
        color: "#037f0c",
        icon: "🔄",
        content: dataFlowMd,
    },
    "security-controls": {
        title: "Security Controls",
        description: "Authentication, WAF, encryption, logging, and authorization best practices",
        badge: "Security",
        color: "#7d3a00",
        icon: "🛡️",
        content: securityControlsMd,
    },
    "threat-model": {
        title: "Threat Model",
        description: "STRIDE analysis, threat matrix, data flow threats, and recommendations",
        badge: "Threat Model",
        color: "#b0003a",
        icon: "⚠️",
        content: threatModelMd,
    },
};

/* ── Markdown renderers — clean light theme ── */
const md: Record<string, any> = {
    h1: ({ children, ...p }: any) => (
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px", color: "#0d1117", borderBottom: "2px solid #e5e7eb", paddingBottom: 12 }} {...p}>{children}</h1>
    ),
    h2: ({ children, ...p }: any) => (
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: "32px 0 10px", color: "#111827", display: "flex", alignItems: "center", gap: 8 }} {...p}>
            <span style={{ display: "inline-block", width: 3, height: 18, background: "#0972d3", borderRadius: 2, flexShrink: 0 }} />
            {children}
        </h2>
    ),
    h3: ({ children, ...p }: any) => (
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: "20px 0 8px", color: "#374151" }} {...p}>{children}</h3>
    ),
    p: ({ children, ...p }: any) => (
        <p style={{ margin: "8px 0 14px", lineHeight: 1.75, color: "#374151", fontSize: 14 }} {...p}>{children}</p>
    ),
    table: ({ children, ...p }: any) => (
        <div style={{ overflowX: "auto", margin: "16px 0", borderRadius: 8, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} {...p}>{children}</table>
        </div>
    ),
    thead: ({ children, ...p }: any) => (
        <thead style={{ background: "#f8fafc" }} {...p}>{children}</thead>
    ),
    th: ({ children, ...p }: any) => (
        <th style={{ padding: "11px 16px", textAlign: "left", fontWeight: 600, color: "#111827", borderBottom: "1px solid #e5e7eb", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }} {...p}>{children}</th>
    ),
    td: ({ children, ...p }: any) => (
        <td style={{ padding: "10px 16px", borderBottom: "1px solid #f3f4f6", color: "#374151", verticalAlign: "top" }} {...p}>{children}</td>
    ),
    tr: ({ children, ...p }: any) => (
        <tr onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={e => (e.currentTarget.style.background = "")} {...p}>{children}</tr>
    ),
    code: ({ node, inline, className, children, ...p }: any) => {
        const isBlock = !inline && (String(children).includes("\n") || String(children).length > 80);
        if (!isBlock) {
            return (
                <code style={{ background: "#f1f5f9", padding: "2px 7px", borderRadius: 5, fontSize: 12.5, color: "#0f4c81", fontFamily: "'SFMono-Regular', Consolas, Menlo, monospace", border: "1px solid #e2e8f0" }} {...p}>{children}</code>
            );
        }
        return (
            <pre style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, padding: "16px 20px", overflowX: "auto", margin: "14px 0", fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre" }}>
                <code style={{ color: "#c9d1d9", fontFamily: "'SFMono-Regular', Consolas, Menlo, monospace" }} {...p}>{children}</code>
            </pre>
        );
    },
    blockquote: ({ children, ...p }: any) => (
        <blockquote style={{ borderLeft: "3px solid #0972d3", margin: "16px 0", padding: "10px 16px", background: "#eff6ff", borderRadius: "0 8px 8px 0", color: "#1e40af" }} {...p}>{children}</blockquote>
    ),
    ul: ({ children, ...p }: any) => (
        <ul style={{ paddingLeft: 20, margin: "8px 0 14px", color: "#374151" }} {...p}>{children}</ul>
    ),
    ol: ({ children, ...p }: any) => (
        <ol style={{ paddingLeft: 20, margin: "8px 0 14px", color: "#374151" }} {...p}>{children}</ol>
    ),
    li: ({ children, ...p }: any) => (
        <li style={{ margin: "5px 0", lineHeight: 1.7, color: "#374151", fontSize: 14 }} {...p}>{children}</li>
    ),
    hr: (p: any) => (
        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "28px 0" }} {...p} />
    ),
    strong: ({ children, ...p }: any) => (
        <strong style={{ color: "#111827", fontWeight: 600 }} {...p}>{children}</strong>
    ),
    a: ({ children, href, ...p }: any) => (
        <a href={href} style={{ color: "#0972d3", textDecoration: "none", borderBottom: "1px solid #bfdbfe" }} target="_blank" rel="noopener noreferrer" {...p}>{children}</a>
    ),
};

/* ── Document index (card grid) ── */
export const DocumentIndex = () => {
    const navigate = useNavigate();
    return (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 0" }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0d1117", margin: "0 0 8px" }}>Design Docs</h1>
                <p style={{ color: "#6b7280", fontSize: 15, margin: 0 }}>Design review documentation for the AnyCompany CRM application</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {Object.entries(DOCUMENTS).map(([slug, doc]) => (
                    <div
                        key={slug}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${doc.title}`}
                        onClick={() => navigate(`/crm/docs/${slug}`)}
                        onKeyDown={e => e.key === "Enter" && navigate(`/crm/docs/${slug}`)}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }}
                        style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24, cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
                    >
                        <div style={{ fontSize: 28, marginBottom: 12 }}>{doc.icon}</div>
                        <div style={{ display: "inline-block", background: doc.color + "18", color: doc.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, marginBottom: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                            {doc.badge}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{doc.title}</div>
                        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{doc.description}</div>
                        <div style={{ marginTop: 16, fontSize: 13, color: doc.color, fontWeight: 500 }}>Read document →</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ── Single document viewer ── */
const DocumentViewerPage = () => {
    const { docSlug } = useParams<{ docSlug: string }>();
    const navigate = useNavigate();
    const doc = docSlug ? DOCUMENTS[docSlug] : undefined;

    const content = useMemo(() => {
        if (!doc) return null;
        return doc.content.replace(/^#\s+.+\n/, "");
    }, [doc]);

    if (!doc || !content) {
        return (
            <div style={{ padding: 40, textAlign: "center" }}>
                <p style={{ color: "#6b7280" }}>Document not found.</p>
                <button onClick={() => navigate("/crm/docs")} style={{ marginTop: 12, padding: "8px 16px", background: "#0972d3", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    Back to Design Docs
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 0" }}>
            {/* Back + badge row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <button
                    onClick={() => navigate("/crm/docs")}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#374151", fontSize: 13, fontWeight: 500 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                    ← Design Docs
                </button>
                <span style={{ background: doc.color + "18", color: doc.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {doc.badge}
                </span>
            </div>

            {/* Document card */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {/* Header band */}
                <div style={{ borderTop: `4px solid ${doc.color}`, padding: "28px 36px 20px", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>{doc.icon}</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0d1117", margin: "0 0 6px" }}>{doc.title}</h1>
                    <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>{doc.description}</p>
                </div>

                {/* Markdown body */}
                <div style={{ padding: "28px 36px", fontSize: 14, lineHeight: 1.75, color: "#374151" }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default DocumentViewerPage;
