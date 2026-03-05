import { Authenticator, Button } from "@aws-amplify/ui-react";
import { signInWithRedirect } from "aws-amplify/auth";
import { useEffect, useRef } from "react";
import Amazicon from "./amazicon.svg";
import "./Login.css";

/** Lightweight particle system drawn on a background canvas */
function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animId: number;
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener("resize", resize);

        interface Particle { x: number; y: number; vx: number; vy: number; r: number; o: number; }
        const particles: Particle[] = Array.from({ length: 60 }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r: Math.random() * 2 + 0.5,
            o: Math.random() * 0.4 + 0.1,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            const w = window.innerWidth, h = window.innerHeight;

            for (const p of particles) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(148, 163, 184, ${p.o})`;
                ctx.fill();
            }

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(99, 102, 241, ${0.08 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            animId = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
        };
    }, [canvasRef]);
}

const Login = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useParticles(canvasRef);

    return (
        <div className="login-page">
            <canvas ref={canvasRef} className="login-particles" />
            <div className="login-orb-3" />

            <div className="login-banner">
                {"⚠️ This is an intentionally vulnerable application for educational purposes only"}
            </div>

            <div className="login-card">
                <Authenticator
                    hideSignUp={true}
                    components={{
                        SignIn: {
                            Header: () => (
                                <div style={{ display: "flex", flexDirection: "column", paddingBottom: "8px", width: "100%", boxSizing: "border-box" }}>
                                    <div className="login-title">
                                        <div className="login-icon">🛡️</div>
                                        <h1>AWS Security Agent Demo</h1>
                                        <p>Educational Vulnerability Testing Platform</p>
                                    </div>

                                    <Button
                                        onClick={() => signInWithRedirect()}
                                        gap="0.75rem"
                                        isFullWidth
                                    >
                                        <img src={Amazicon} alt="Amazon icon" style={{ width: "15px", flexShrink: 0, filter: "brightness(0) invert(1)" }} />
                                        Sign in with Midway
                                    </Button>
                                    <div className="login-divider">
                                        <span className="login-divider-line" />
                                        <span className="login-divider-text">or</span>
                                        <span className="login-divider-line" />
                                    </div>
                                </div>
                            ),
                            Footer: () => null,
                        },
                    }}
                />
            </div>
        </div>
    );
};

export default Login;
