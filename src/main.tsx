import { createRoot } from "react-dom/client";
import "./i18n/config";
import { bootstrapGeneratedSiteAnalytics } from "./analytics.ts";
import App from "./App.tsx";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root was not found.");
}

bootstrapGeneratedSiteAnalytics();

/** mostra o erro na tela (em vez de página em branco) quando a inicialização falha */
function mostraErroFatal(mensagem: string) {
  const el = document.getElementById("root");
  if (!el || el.childElementCount > 0) return;
  const box = document.createElement("div");
  box.style.cssText =
    "min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;background:#f6f8fb;color:#111827";
  const card = document.createElement("div");
  card.style.cssText =
    "max-width:560px;width:100%;border:1px solid #dbe2ea;border-radius:12px;background:#fff;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08)";
  const h = document.createElement("h1");
  h.textContent = "Não foi possível abrir o app";
  h.style.cssText = "font-size:18px;font-weight:600;margin:0 0 8px";
  const p = document.createElement("p");
  p.textContent = "Ocorreu um erro ao carregar. Detalhe técnico (envie para o suporte):";
  p.style.cssText = "font-size:14px;color:#4b5563;margin:0 0 12px";
  const pre = document.createElement("pre");
  pre.textContent = mensagem;
  pre.style.cssText =
    "max-height:200px;overflow:auto;background:#f3f4f6;border-radius:8px;padding:12px;font-size:12px;margin:0";
  const btn = document.createElement("button");
  btn.textContent = "Recarregar";
  btn.style.cssText =
    "margin-top:16px;background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer";
  btn.addEventListener("click", () => window.location.reload());
  card.append(h, p, pre, btn);
  box.append(card);
  el.innerHTML = "";
  el.append(box);
}

window.addEventListener("error", (e) => mostraErroFatal(e.message || "erro desconhecido"));
window.addEventListener("unhandledrejection", (e) =>
  mostraErroFatal(String((e as PromiseRejectionEvent).reason ?? "promessa rejeitada")),
);

try {
  createRoot(container).render(<App />);
} catch (err) {
  mostraErroFatal(err instanceof Error ? err.message : String(err));
}
