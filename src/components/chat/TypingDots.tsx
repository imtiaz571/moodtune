export function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm w-fit" style={{ background: "rgba(255,255,255,0.07)" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: "#a78bfa", animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }} />
      ))}
    </div>
  );
}
