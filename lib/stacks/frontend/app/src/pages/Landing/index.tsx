/**
 * Post-login landing page for AWS Security Agent Demo.
 * Shown after authentication — provides overview and navigation to the CRM.
 */
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";

const FEATURES = [
    { icon: "\uD83D\uDD0D", title: "Design Review", desc: "Automated threat modeling and architecture analysis to identify security risks before code is written" },
    { icon: "\uD83D\uDCDD", title: "Code Review", desc: "Deep static analysis that finds vulnerabilities in source code with contextual remediation guidance" },
    { icon: "\uD83C\uDFAF", title: "Pen Testing", desc: "Automated penetration testing that discovers exploitable vulnerabilities in running applications" },
];

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(-45deg, #0a0a1a, #1a0a2e, #0a1628, #0d1117)",
            backgroundSize: "400% 400%",
            animation: "gradientShift 15s ease infinite",
            display: "flex",
            flexDirection: "column",
            fontFamily: "system-ui, -apple-system, sans-serif",
            position: "relative",
            overflow: "hidden",
        }}>
            {/* Background orbs */}
            <div style={{ position: "fixed", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)", filter: "blur(80px)", top: "-100px", right: "-100px", pointerEvents: "none" }} />
            <div style={{ position: "fixed", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)", filter: "blur(80px)", bottom: "-80px", left: "-80px", pointerEvents: "none" }} />

            {/* Nav */}
            <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", position: "relative", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
                        {"\uD83D\uDEE1\uFE0F"}
                    </div>
                    <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "16px" }}>AWS Security Agent</span>
                </div>
                <button onClick={async () => { await signOut({ global: false }); window.location.href = "/"; }}
                    style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 20px", fontSize: "14px", cursor: "pointer" }}>
                    Sign Out
                </button>
            </nav>

            {/* Hero */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "60px 24px", position: "relative", zIndex: 1 }}>
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                    {/* Badge */}
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "6px 16px", marginBottom: "28px", fontSize: "13px", color: "#94a3b8" }}>
                        {"\u2728"} Frontier Agent
                    </div>

                    <h1 style={{ fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 700, color: "#f1f5f9", margin: "0 0 20px", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
                        AWS Security Agent<br />
                        <span style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Demo</span>
                    </h1>

                    <p style={{ fontSize: "18px", color: "#94a3b8", maxWidth: "560px", margin: "0 auto 40px", lineHeight: 1.7 }}>
                        An AI-powered security agent that performs automated design reviews, code analysis, and penetration testing to find vulnerabilities in your applications.
                    </p>

                    {/* CTAs */}
                    <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "60px" }}>
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            onClick={() => navigate("/crm")}
                            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: "10px", padding: "14px 28px", fontSize: "15px", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
                            Go to Error Simulator {"\u2192"}
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                            onClick={() => window.open("https://app-128b7ba1-4b4a-4d72-8d51-462bd04d2981.securityagent.global.app.aws", "_blank")}
                            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "transparent", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", padding: "14px 28px", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}>
                            View Security Agent Portal {"\u2197"}
                        </motion.button>
                    </div>
                </motion.div>

                {/* Feature cards */}
                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
                    style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", maxWidth: "800px", width: "100%" }}>
                    {FEATURES.map((f, i) => (
                        <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px", textAlign: "left" }}>
                            <div style={{ fontSize: "24px", marginBottom: "12px" }}>{f.icon}</div>
                            <div style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9", marginBottom: "6px" }}>{f.title}</div>
                            <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", lineHeight: 1.5 }}>{f.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Warning badge */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }}
                    style={{ marginTop: "40px", display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", color: "#fca5a5" }}>
                    {"\u26A0\uFE0F"} This is an intentionally vulnerable application for educational purposes only
                </motion.div>
            </div>

            <style>{`
                @keyframes gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
        </div>
    );
};

export default LandingPage;
