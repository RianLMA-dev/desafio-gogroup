"use client";
import { useState } from "react";
import { FileText, X, Loader2, RefreshCw } from "lucide-react";
import type { Relatorio } from "@/lib/agente/tipos";
import AgenteAvatar from "./AgenteAvatar";

const COR_SEV: Record<string, string> = { "crítica": "var(--critical)", alta: "var(--serious)", "média": "var(--warning)", baixa: "var(--muted)" };

export default function RelatorioIncidente({ id, salvo }: { id: string; salvo?: Relatorio }) {
  const [aberto, setAberto] = useState(false);
  const [rel, setRel] = useState<Relatorio | null>(salvo ?? null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async () => {
    setCarregando(true); setErro(null);
    try {
      const r = await fetch("/api/agente/processo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      setRel(j);
    } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  };
  const abrir = () => { setAberto(true); if (!rel) gerar(); };

  return (
    <>
      <button onClick={abrir} className="btn btn-ghost shrink-0 border-ai-line text-ai-strong hover:bg-ai-soft"><FileText size={15} /> {salvo ? "Ver relatório de incidente" : "Gerar relatório de incidente"}</button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6" onClick={() => setAberto(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.1em] text-ai-strong"><AgenteAvatar tipo="processo" tamanho={22} /> Relatório de incidente · Agente de Processo</div>
              <button onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-lg p-1 hover:bg-surface-2"><X size={20} /></button>
            </div>
            {carregando && <div className="flex items-center gap-2 py-16 text-sm text-muted"><Loader2 size={16} className="animate-spin text-ai" /> O agente está analisando a evidência e escrevendo o relatório…</div>}
            {erro && <div className="mt-4 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">{erro}</div>}
            {rel && !carregando && (
              <article className="mt-3">
                <h2 className="text-xl font-semibold">{rel.titulo}</h2>
                <div className="mt-2 flex items-center gap-3 text-xs text-ink-2">
                  <span className="chip border border-line"><span className="h-2 w-2 rounded-full" style={{ background: COR_SEV[rel.severidade] ?? "var(--muted)" }} />Severidade {rel.severidade}</span>
                  <span className="text-muted">{rel.simulado ? "modelo sem IA" : rel.modelo} · {new Date(rel.gerado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                <p className="mt-4 font-medium leading-relaxed">{rel.resumo_executivo}</p>
                <Secao t="O que está acontecendo">{rel.o_que_acontece}</Secao>
                <Secao t="Evidências"><ul className="list-disc space-y-1 pl-5">{rel.evidencias.map((e) => <li key={e}>{e}</li>)}</ul></Secao>
                <Secao t="Causa raiz">{rel.causa_raiz}</Secao>
                <Secao t="Impacto">{rel.impacto}</Secao>
                <Secao t="Plano de ação">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-1.5 font-normal">Ação</th><th className="py-1.5 font-normal">Responsável</th><th className="py-1.5 font-normal">Prazo</th></tr></thead>
                    <tbody>{rel.acoes.map((a) => <tr key={a.acao} className="border-b border-line last:border-0 align-top"><td className="py-2 pr-3">{a.acao}</td><td className="py-2 pr-3 text-ink-2">{a.responsavel}</td><td className="whitespace-nowrap py-2 text-ink-2">{a.prazo}</td></tr>)}</tbody>
                  </table>
                </Secao>
                <Secao t="Pedidos já afetados">{rel.pedidos_afetados}</Secao>
                <Secao t="Como saber se resolveu">{rel.como_medir}</Secao>
                <button onClick={gerar} className="btn btn-ghost mt-6"><RefreshCw size={15} /> Gerar de novo ao vivo</button>
              </article>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Secao({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{t}</h3>
      <div className="mt-1.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}
