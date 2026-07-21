import { X, ExternalLink } from "lucide-react";
import { Toast } from "../../types";

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2" style={{ pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium animate-bounce"
          style={{
            pointerEvents: "auto",
            background: t.type === "success" ? "rgba(52,211,153,0.15)" : t.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(96,165,250,0.15)",
            border: `1px solid ${t.type === "success" ? "#34d39940" : t.type === "error" ? "#ef444440" : "#60a5fa40"}`,
            color: t.type === "success" ? "#34d399" : t.type === "error" ? "#ef4444" : "#60a5fa",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <span>{t.msg}</span>
          {t.link && (
            <a href={t.link} target="_blank" rel="noreferrer" className="underline flex items-center gap-1">
              {t.linkText ?? "Open"} <ExternalLink size={12} />
            </a>
          )}
          <button onClick={() => onRemove(t.id)} style={{ opacity: 0.6 }}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
