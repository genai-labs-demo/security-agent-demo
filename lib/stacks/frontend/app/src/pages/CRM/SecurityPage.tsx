import { Box, StatusIndicator, Button, Popover, Icon, Modal, SpaceBetween } from "@cloudscape-design/components";
import { useEffect, useState, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

interface BI { scenario: string; risk: string; impact: string; example: string; }
interface VD { id: string; icon: string; title: string; tag: string; tagColor: string; description: string; href: string; accentColor: string; bi: BI; }

const VULNS: VD[] = [
  { id:"sqli", icon:"\uD83D\uDD13", title:"SQL Injection", tag:"CRITICAL", tagColor:"#ef4444", accentColor:"#ef4444",
    description:"Discover how unsanitized database queries can bypass authentication and extract sensitive data.",
    href:"/crm/security/profile",
    bi:{ scenario:"CRM User Profile Lookup", risk:"Attacker modifies SQL queries via account search to dump the customer database.", impact:"Full PII exposure, revenue forecast leaks, GDPR/CCPA fines.", example:"' OR 1=1 -- returns all customer records." }},
  { id:"xss", icon:"\u26A1", title:"Cross-Site Scripting (XSS)", tag:"HIGH", tagColor:"#f59e0b", accentColor:"#f59e0b",
    description:"Learn about reflected and stored XSS that allows malicious script injection into web pages.",
    href:"/crm/security/comments",
    bi:{ scenario:"CRM Comments & Notes", risk:"Embedded JS in opportunity comments steals session tokens from every viewer.", impact:"Session hijacking, worm-like spread across all CRM users.", example:"Script tag in a comment sends cookies to attacker." }},
  { id:"xss2", icon:"\uD83D\uDCA5", title:"Advanced XSS", tag:"HIGH", tagColor:"#f59e0b", accentColor:"#a855f7",
    description:"Explore DOM-based and attribute-based XSS that exploits client-side JavaScript.",
    href:"/crm/security/xss-advanced",
    bi:{ scenario:"Dashboard Widgets & Custom Fields", risk:"Crafted URLs manipulate the CRM interface to show fake data or harvest credentials.", impact:"Manipulated dashboards, credential theft without server detection.", example:"Malicious filter parameter in a shared pipeline link." }},
  { id:"cmdi", icon:"\uD83D\uDCBB", title:"Command Injection", tag:"CRITICAL", tagColor:"#ef4444", accentColor:"#3b82f6",
    description:"Explore how unsanitized input to system commands enables arbitrary code execution.",
    href:"/crm/security/tools",
    bi:{ scenario:"CRM Export & Reporting", risk:"Report generation passes user input to OS commands, enabling shell access.", impact:"Full server compromise, database exfiltration, ransomware deployment.", example:"'quarterly; cat /etc/passwd' in filename field." }},
];

const CAPS = [
  { icon:"\uD83D\uDD0D", title:"Design Review", desc:"Automated threat modeling and architecture analysis to identify security risks before code is written" },
  { icon:"\uD83D\uDCDD", title:"Code Review", desc:"Deep static analysis that finds vulnerabilities in source code with contextual remediation guidance" },
  { icon:"\uD83C\uDFAF", title:"Pen Testing", desc:"Automated penetration testing that discovers exploitable vulnerabilities in running applications" },
];

const STEPS = [
  { n:1, icon:"\uD83D\uDD17", title:"Log In to Security Agent Portal", desc:"Open the portal to explore the setup, design review, code review, and pen testing capabilities" },
  { n:2, icon:"\uD83D\uDEE1\uFE0F", title:"Explore CRM Vulnerabilities", desc:"Use the vulnerability demos below to interact with intentional security flaws in this CRM app" },
  { n:3, icon:"\uD83C\uDFAF", title:"Run a Pen Test", desc:"After exploring vulnerabilities, head to the AWS Security Agent console to create and run a pen test" },
];

const sec = (bg: string): CSSProperties => ({ padding:"64px 40px", textAlign:"center", background:bg });
const grid = (c: number): CSSProperties => ({ display:"grid", gridTemplateColumns:`repeat(${c},1fr)`, gap:"20px", maxWidth:"960px", margin:"0 auto" });
const BLUE = "#0972d3";
const T1 = "#111827"; /* headings */
const T2 = "#374151"; /* body text */
const T3 = "#6b7280"; /* subtle labels */

const BIContent = ({ b }: { b: BI }) => (
  <SpaceBetween size="s">
    <Box variant="strong" fontSize="heading-xs" color="text-status-info">{b.scenario}</Box>
    <div><Box variant="strong" fontSize="body-s">CRM Risk:</Box><p style={{ margin:"4px 0 0", fontSize:"13px", color:T2 }}>{b.risk}</p></div>
    <div><Box variant="strong" fontSize="body-s">Business Impact:</Box><p style={{ margin:"4px 0 0", fontSize:"13px", color:T2 }}>{b.impact}</p></div>
    <div style={{ padding:"10px 12px", borderRadius:"8px", background:"rgba(0,0,0,0.04)", border:"1px solid rgba(0,0,0,0.08)" }}>
      <Box variant="strong" fontSize="body-s">Example:</Box>
      <p style={{ margin:"4px 0 0", fontSize:"12px", color:T2 }}><code>{b.example}</code></p>
    </div>
  </SpaceBetween>
);

const VCard = ({ d, i }: { d: VD; i: number }) => {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (<>
    <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.4, delay:i*0.08 }}
      whileHover={{ y:-4, transition:{ duration:0.15 } }} onClick={() => nav(d.href)}
      style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px", padding:"24px", cursor:"pointer", textAlign:"left", transition:"box-shadow 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px" }}>
        <span style={{ fontSize:"28px" }}>{d.icon}</span>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <span onClick={e => { e.stopPropagation(); setOpen(true); }}
            style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"24px", height:"24px", borderRadius:"50%", background:`${d.accentColor}12`, border:`1px solid ${d.accentColor}30`, cursor:"pointer", color:d.accentColor }}
            role="button" aria-label={`Impact info for ${d.title}`}><Icon name="status-info" size="small" /></span>
          <span style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.08em", padding:"3px 8px", borderRadius:"6px", background:`${d.tagColor}15`, color:d.tagColor, border:`1px solid ${d.tagColor}25` }}>{d.tag}</span>
        </div>
      </div>
      <div style={{ fontSize:"16px", fontWeight:600, color:T1, marginBottom:"6px" }}>{d.title}</div>
      <p style={{ margin:0, fontSize:"13px", color:T2, lineHeight:1.6 }}>{d.description}</p>
      <div style={{ marginTop:"16px", fontSize:"13px", fontWeight:500, color:d.accentColor }}>Explore demo {"\u2192"}</div>
    </motion.div>
    <Modal visible={open} onDismiss={() => setOpen(false)} header={`CRM Impact: ${d.title}`} size="medium"
      footer={<Box float="right"><Button variant="primary" onClick={() => setOpen(false)}>Close</Button></Box>}>
      <BIContent b={d.bi} />
    </Modal>
  </>);
};

const SecurityPage = () => {
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [health, setHealth] = useState<{label:string; status:"loading"|"success"|"error"; msg:string}[]>([
    { label:"Database (RDS)", status:"loading", msg:"Checking..." },
    { label:"Auth (Cognito)", status:"loading", msg:"Checking..." },
    { label:"Overall", status:"loading", msg:"Checking..." },
  ]);
  useEffect(() => { const t = setTimeout(() => setHealth([
    { label:"Database (RDS)", status:"success", msg:"Connected" },
    { label:"Auth (Cognito)", status:"success", msg:"Active" },
    { label:"Overall", status:"success", msg:"All systems go" },
  ]), 1500); return () => clearTimeout(t); }, []);

  return (
    <div>

      {/* HERO */}
      <div style={{ background:"linear-gradient(180deg,#0a1628 0%,#0d2137 60%,#0f2b46 100%)", padding:"100px 40px 80px", textAlign:"center", position:"relative", overflow:"hidden", minHeight:"420px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        {/* Subtle dot grid */}
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize:"28px 28px", pointerEvents:"none" }} />
        {/* Soft glow */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"600px", height:"300px", background:"radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)", pointerEvents:"none" }} />

        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6 }} style={{ position:"relative", zIndex:1, maxWidth:"720px", width:"100%" }}>
          {/* Badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"20px", padding:"5px 14px", marginBottom:"28px", fontSize:"12px", color:"#94a3b8", letterSpacing:"0.02em" }}>
            {"\u2728"} AI-Powered Security Analysis
          </div>

          {/* Title */}
          <h1 style={{ fontSize:"clamp(32px,4vw,46px)", fontWeight:700, color:"#f1f5f9", margin:"0 0 18px", letterSpacing:"-0.025em", lineHeight:1.15 }}>
            AWS Security Agent Demo
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize:"16px", color:"#94a3b8", maxWidth:"560px", margin:"0 auto 36px", lineHeight:1.75 }}>
            An AI-powered security agent that performs design reviews, code analysis, and penetration testing to find and report vulnerabilities in your applications.
          </p>

          {/* CTA Buttons */}
          <div style={{ display:"flex", justifyContent:"center", gap:"10px", flexWrap:"wrap", marginBottom:"32px" }}>
            <motion.button whileHover={{ scale:1.02, boxShadow:"0 6px 24px rgba(245,158,11,0.35)" }} whileTap={{ scale:0.98 }}
              onClick={() => window.open("https://app-128b7ba1-4b4a-4d72-8d51-462bd04d2981.securityagent.global.app.aws","_blank")}
              style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"#f59e0b", color:"#0f172a", border:"none", borderRadius:"8px", padding:"11px 22px", fontSize:"14px", fontWeight:600, cursor:"pointer", boxShadow:"0 4px 16px rgba(245,158,11,0.25)", transition:"all 0.2s" }}>
              {"\u2728"} Open Security Agent Portal {"\u2197"}
            </motion.button>
            <motion.button whileHover={{ scale:1.02, borderColor:"rgba(255,255,255,0.35)" }} whileTap={{ scale:0.98 }}
              onClick={() => document.getElementById("vuln-demos")?.scrollIntoView({ behavior:"smooth" })}
              style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"rgba(255,255,255,0.05)", color:"#e2e8f0", border:"1px solid rgba(255,255,255,0.18)", borderRadius:"8px", padding:"11px 22px", fontSize:"14px", fontWeight:500, cursor:"pointer", transition:"all 0.2s" }}>
              Try Vulnerability Demos {"\u2192"}
            </motion.button>
          </div>

          {/* Credentials */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:"8px" }}>
            <Popover
              size="small"
              position="top"
              triggerType="custom"
              content={<span style={{ fontSize:"13px" }}>These credentials are used to log in to the <strong>Security Agent Portal</strong> — click "Open Security Agent Portal" above.</span>}
            >
              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"18px", height:"18px", borderRadius:"50%", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer", color:"#94a3b8", fontSize:"11px", fontStyle:"italic", fontFamily:"Georgia,serif", flexShrink:0 }}>i</span>
            </Popover>
            <div style={{ display:"inline-flex", alignItems:"center", gap:"20px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"10px", padding:"8px 18px", fontSize:"12px", color:"#64748b" }}>
              <span style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                <strong style={{ color:"#94a3b8", fontWeight:500 }}>Console:</strong> {"\u2022\u2022\u2022\u2022\u2022\u2022"}
                <Popover size="small" position="top" triggerType="custom" dismissButton={false} content={<StatusIndicator type="success">Copied</StatusIndicator>}>
                  <Button variant="inline-icon" iconName="copy" ariaLabel="Copy username" onClick={() => navigator.clipboard.writeText("aws_user")} />
                </Popover>
              </span>
              <span style={{ width:"1px", height:"16px", background:"rgba(255,255,255,0.1)" }} />
              <span style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                <strong style={{ color:"#94a3b8", fontWeight:500 }}>Password:</strong> {"\u2022\u2022\u2022\u2022\u2022\u2022"}
                <Popover size="small" position="top" triggerType="custom" dismissButton={false} content={<StatusIndicator type="success">Copied</StatusIndicator>}>
                  <Button variant="inline-icon" iconName="copy" ariaLabel="Copy password" onClick={() => navigator.clipboard.writeText("AWS123xyz!")} />
                </Popover>
              </span>
            </div>
          </div>

          {/* Status strip */}
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.6, delay:0.4 }}
            style={{ marginTop:"20px", display:"flex", justifyContent:"center", alignItems:"center", gap:"20px", flexWrap:"wrap" }}>
            {health.map((h, i) => (
              <div key={h.label} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#64748b" }}>
                {h.status === "loading"
                  ? <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#475569", display:"inline-block" }} />
                  : <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#22c55e", display:"inline-block", boxShadow:"0 0 6px rgba(34,197,94,0.5)" }} />
                }
                <span style={{ color:"#94a3b8" }}>{h.label}:</span>
                <span style={{ color: h.status === "loading" ? "#64748b" : "#22c55e", fontWeight:500 }}>{h.msg}</span>
                {i < health.length - 1 && <span style={{ marginLeft:"12px", width:"1px", height:"12px", background:"rgba(255,255,255,0.08)", display:"inline-block" }} />}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div animate={{ y:[0,6,0] }} transition={{ repeat:Infinity, duration:2.5 }}
          style={{ position:"absolute", bottom:"20px", left:"50%", transform:"translateX(-50%)", color:"rgba(255,255,255,0.2)", fontSize:"18px", cursor:"pointer" }}
          onClick={() => document.getElementById("about-section")?.scrollIntoView({ behavior:"smooth" })}>{"\u2304"}</motion.div>
      </div>

      {/* ABOUT */}
      <div id="about-section" style={{ padding:"64px 40px", textAlign:"center", background:"#eef5fc" }}>
        <motion.div initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}>
          <h2 style={{ fontSize:"28px", fontWeight:700, color:T1, margin:"0 0 12px" }}>About This Demo</h2>
          <div style={{ width:"48px", height:"3px", background:"#0972d3", borderRadius:"2px", margin:"0 auto 24px" }} />
          <p style={{ fontSize:"15px", color:T2, maxWidth:"680px", margin:"0 auto 12px", lineHeight:1.8 }}>
            This CRM application serves as a demo environment to showcase AWS Security Agent integration. It contains intentional security vulnerabilities that demonstrate how the agent performs automated design reviews, code analysis, and penetration testing.
          </p>
          <p style={{ fontSize:"15px", color:T2, maxWidth:"680px", margin:"0 auto 56px", lineHeight:1.8 }}>
            Explore the <strong style={{ color:T1 }}>Vulnerability Demos</strong> below to trigger real detections and observe how the Security Agent automatically identifies, categorizes, and reports security findings.
          </p>
        </motion.div>

        {/* STEPS — merged into same section to avoid double padding gap */}
        <motion.div initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}>
          <h2 style={{ fontSize:"28px", fontWeight:700, color:T1, margin:"0 0 8px" }}>How to Use This Demo</h2>
          <p style={{ fontSize:"14px", color:T3, margin:"0 0 40px" }}>Follow these steps to experience security analysis capabilities</p>
        </motion.div>
        <div style={grid(3)}>
          {STEPS.map((s,i) => (
            <motion.div key={s.n} initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.4, delay:i*0.1 }}
              style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px", padding:"28px 20px", textAlign:"center" }}>
              <div style={{ width:"48px", height:"48px", borderRadius:"50%", background:BLUE, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", margin:"0 auto 12px", color:"#fff" }}>{s.icon}</div>
              <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.1em", color:BLUE, marginBottom:"6px" }}>STEP {s.n}</div>
              <div style={{ fontSize:"15px", fontWeight:600, color:T1, marginBottom:"6px" }}>{s.title}</div>
              <p style={{ margin:0, fontSize:"13px", color:T2, lineHeight:1.5 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* VULN DEMOS */}
      <div id="vuln-demos" style={sec("#f8f9fa")}>
        <motion.div initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}>
          <h2 style={{ fontSize:"28px", fontWeight:700, color:T1, margin:"0 0 8px" }}>Vulnerability Demonstrations</h2>
          <p style={{ fontSize:"14px", color:T3, margin:"0 0 40px" }}>Explore intentional security vulnerabilities to see how AWS Security Agent detects them</p>
        </motion.div>
        <div style={grid(2)}>
          {VULNS.map((d,i) => <VCard key={d.id} d={d} i={i} />)}
        </div>
        <motion.div initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} transition={{ duration:0.5, delay:0.3 }} style={{ marginTop:"48px" }}>
          {/* ARCHITECTURE DIAGRAM */}
          <div style={{ marginBottom:"48px" }}>
            <motion.div initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}>
              <h2 style={{ fontSize:"28px", fontWeight:700, color:T1, margin:"0 0 8px" }}>Architecture Overview</h2>
              <p style={{ fontSize:"14px", color:T3, margin:"0 0 32px" }}>How the AWS Security Agent integrates with this demo application</p>
            </motion.div>
            <motion.div initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.5, delay:0.1 }}
              onClick={() => setDiagramOpen(true)}
              style={{ maxWidth:"960px", margin:"0 auto", background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px", padding:"16px", cursor:"pointer", position:"relative", transition:"box-shadow 0.2s" }}
              whileHover={{ boxShadow:"0 8px 24px rgba(0,0,0,0.1)" }}>
              <img src="/SecurityAgentDiagram.png" alt="AWS Security Agent Architecture Diagram" style={{ width:"100%", borderRadius:"8px", display:"block" }} />
              <div style={{ position:"absolute", bottom:"24px", right:"24px", background:"rgba(0,0,0,0.6)", color:"#fff", borderRadius:"8px", padding:"6px 14px", fontSize:"12px", fontWeight:500, display:"flex", alignItems:"center", gap:"6px", backdropFilter:"blur(4px)" }}>
                {"\uD83D\uDD0D"} Click to expand
              </div>
            </motion.div>
          </div>

          {/* DIAGRAM LIGHTBOX */}
          {diagramOpen && (
            <div onClick={() => setDiagramOpen(false)}
              style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"zoom-out", backdropFilter:"blur(4px)" }}>
              <div style={{ position:"relative", maxWidth:"95vw", maxHeight:"95vh", padding:"16px" }} onClick={e => e.stopPropagation()}>
                <img src="/SecurityAgentDiagram.png" alt="AWS Security Agent Architecture Diagram"
                  style={{ maxWidth:"95vw", maxHeight:"90vh", objectFit:"contain", borderRadius:"12px", boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }} />
                <button onClick={() => setDiagramOpen(false)}
                  style={{ position:"absolute", top:"0", right:"0", width:"36px", height:"36px", borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)", color:"#fff", fontSize:"18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}
                  aria-label="Close diagram">
                  {"\u2715"}
                </button>
              </div>
            </div>
          )}

          {/* CAPABILITIES — moved here above the CTA */}
          <div style={{ marginBottom:"48px" }}>
            <motion.div initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.5 }}>
              <h2 style={{ fontSize:"28px", fontWeight:700, color:T1, margin:"0 0 8px" }}>Core Capabilities</h2>
              <p style={{ fontSize:"14px", color:T3, margin:"0 0 32px" }}>Three pillars of automated security analysis powered by AWS Security agent</p>
            </motion.div>
            <div style={grid(3)}>
              {CAPS.map((c,i) => (
                <motion.div key={c.title} initial={{ opacity:0,y:20 }} whileInView={{ opacity:1,y:0 }} viewport={{ once:true }} transition={{ duration:0.4, delay:i*0.1 }}
                  style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px", padding:"28px", textAlign:"left" }}>
                  <div style={{ width:"40px", height:"40px", borderRadius:"10px", background:`${BLUE}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", marginBottom:"16px", color:BLUE }}>{c.icon}</div>
                  <div style={{ fontSize:"16px", fontWeight:600, color:T1, marginBottom:"6px" }}>{c.title}</div>
                  <p style={{ margin:0, fontSize:"13px", color:T2, lineHeight:1.6 }}>{c.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.98 }}
            onClick={() => window.open("https://app-128b7ba1-4b4a-4d72-8d51-462bd04d2981.securityagent.global.app.aws","_blank")}
            style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:BLUE, color:"#fff", border:"none", borderRadius:"8px", padding:"12px 28px", fontSize:"14px", fontWeight:600, cursor:"pointer" }}>
            Open Security Agent Portal {"\u2192"}
          </motion.button>
        </motion.div>
      </div>

    </div>
  );
};

export default SecurityPage;
