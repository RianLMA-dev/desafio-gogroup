"use client";
import { useEffect, useMemo, useState } from "react";
import { Truck, UserRound, Sparkles, ShieldCheck } from "lucide-react";
import type { Decisao } from "@/lib/agente/tipos";
import { lerExecucoes, lerAprovacoes, marcarAprovacao, type StatusAprov } from "@/lib/execucoes";
import { NIVEL } from "@/lib/format";

type D = Decisao & { correcoes?: number; tipo_rotulo?: string; valor?: number };

const ABAS = [
  { id: "aprovacao", rotulo: "Aguardando aprovação" },
  { id: "auto", rotulo: "Executadas pelo agente" },
  { id: "humano", rotulo: "Encaminhadas para pessoa" },
] as const;

/** Junta as decisões do lote com as execuções ao vivo feitas neste navegador. */
export function useDecisoes(lote: D[]) {
  const [vivas, setVivas] = useState<Record<string, Decisao>>({});
  const [aprov, setAprov] = useState<Record<string, StatusAprov>>({});
  useEffect(() => {
    const atualizar = () => { setVivas(lerExecucoes()); setAprov(lerAprovacoes()); };
    atualizar();
    window.addEventListener("central:mudou", atualizar);
    return () => window.removeEventListener("central:mudou", atualizar);
  }, []);
  const todas = useMemo(() => {
    const m = new Map<string, D>(lote.map((d) => [d.id, d]));
    for (const v of Object.values(vivas)) m.set(v.id, { ...m.get(v.id), ...v });
    return [...m.values()];
  }, [lote, vivas]);
  return { todas, aprov, nVivas: Object.keys(vivas).length };
}

export default function AcoesLista({ lote, extras }: { lote: D[]; extras: Record<string, { tipo_rotulo: string; valor: number; rank: number }> }) {
  const { todas, aprov } = useDecisoes(lote);
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("aprovacao");
  const lista = todas.filter((d) => d.nivel === aba).sort((a, b) => (extras[a.id]?.rank ?? 1e9) - (extras[b.id]?.rank ?? 1e9));
  const nAprov = todas.filter((d) => d.nivel === "aprovacao");
  const feitas = nAprov.filter((d) => aprov[d.id]).length;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {ABAS.map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${aba === a.id ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2"}`}>
              {a.rotulo} <span className="tabular text-muted">{todas.filter((d) => d.nivel === a.id).length}</span>
            </button>
          ))}
        </div>
        {aba === "aprovacao" && <div className="text-sm text-ink-2">{feitas} de {nAprov.length} revisadas</div>}
      </div>
      <ul className="divide-y divide-line">
        {lista.map((d) => {
          const x = extras[d.id];
          const st = aprov[d.id];
          return (
            <li key={d.id} className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_1.2fr_auto]">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted">#{x?.rank} · {d.id}{d.correcoes ? <span className="flex items-center gap-1 text-serious-ink"><ShieldCheck size={12} /> corrigida pela política</span> : null}</div>
                <div className="mt-0.5 font-medium">{d.pedido} · {x?.tipo_rotulo}</div>
                <div className="mt-1 flex items-start gap-1.5 text-sm text-ink">
                  <Sparkles size={13} className="mt-[3px] shrink-0 text-accent" />{d.acao_rotulo}
                </div>
                <p className="mt-1 text-sm text-ink-2">{d.justificativa}</p>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                {d.mensagem_cliente && <div className="rounded-lg bg-surface-2 px-3 py-2 text-ink-2">“{d.mensagem_cliente}”</div>}
                {d.mensagem_transportadora && <div className="flex gap-2 text-ink-2"><Truck size={14} className="mt-0.5 shrink-0" />{d.mensagem_transportadora}</div>}
                {d.nota_interna && <div className="flex gap-2 text-ink-2"><UserRound size={14} className="mt-0.5 shrink-0" />{d.nota_interna}</div>}
              </div>
              <div className="flex items-start gap-2 lg:flex-col lg:items-end">
                {d.nivel === "aprovacao" ? (
                  <>
                    <button onClick={() => marcarAprovacao(d.id, st === "aprovada" ? null : "aprovada")} className={`btn justify-center ${st === "aprovada" ? "bg-good text-white" : "btn-primary"}`}>{st === "aprovada" ? "Aprovada" : "Aprovar"}</button>
                    <button onClick={() => marcarAprovacao(d.id, st === "rejeitada" ? null : "rejeitada")} className={`btn btn-ghost justify-center ${st === "rejeitada" ? "border-critical text-critical" : ""}`}>{st === "rejeitada" ? "Rejeitada" : "Rejeitar"}</button>
                  </>
                ) : (
                  <span className="chip border border-line text-ink-2"><span className="h-2 w-2 rounded-full" style={{ background: NIVEL[d.nivel].cor }} />{d.nivel === "auto" ? "Executada" : "Com uma pessoa"}</span>
                )}
                <span className="text-[11px] text-muted">{d.simulado ? "simulado" : d.modelo}</span>
              </div>
            </li>
          );
        })}
        {lista.length === 0 && <li className="p-10 text-center text-sm text-muted">Nenhuma ação aqui ainda.</li>}
      </ul>
    </div>
  );
}
