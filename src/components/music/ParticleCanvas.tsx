import { useEffect, useRef } from "react";

export function ParticleCanvas({ moodColor }: { moodColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let W = (canvas.width = canvas.offsetWidth);
    let H = (canvas.height = canvas.offsetHeight);
    const onResize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    window.addEventListener("resize", onResize);
    const NUM = 70;
    type P = { x: number; y: number; vx: number; vy: number; r: number; o: number; pulse: number };
    const particles: P[] = Array.from({ length: NUM }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5, o: Math.random() * 0.5 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    }));
    const WAVE_POINTS = 120;
    let t = 0;
    const hexToRgb = (hex: string) => ({ r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) });
    const rgb = hexToRgb(moodColor.startsWith("#") ? moodColor : "#60a5fa");
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.008;
      ctx.beginPath();
      for (let i = 0; i <= WAVE_POINTS; i++) {
        const x = (i / WAVE_POINTS) * W;
        const y = H * 0.6 + Math.sin(i * 0.08 + t) * 30 + Math.sin(i * 0.05 + t * 1.3) * 20 + Math.sin(i * 0.12 + t * 0.7) * 12;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`; ctx.lineWidth = 1.5; ctx.stroke();
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.pulse += 0.02;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        const pf = 0.8 + Math.sin(p.pulse) * 0.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pf, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${p.o * pf})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.06 * (1 - dist / 100)})`; ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", onResize); };
  }, [moodColor]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.6 }} />;
}
