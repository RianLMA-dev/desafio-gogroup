"use client";
import { useMemo, useState } from "react";
import { Truck, MessageSquare } from "lucide-react";
import type { Decisao } from "@/lib/agente/tipos";
import { Celular } from "./CelularAgente";
import { useDecisoes } from "./AcoesLista";

type D = Decisao & { correcoes?: number };

export default function MensagensView({ lote, extras }: { lote: D[]; extras: Record<string, { tipo_rotulo: string; rank: number }> }) {
  const { todas, aprov } = useDecisoes(lote);
  const [filtro, setFiltro] = useState<"clientes" | "transportadoras">("clientes");
  const lista = useMemo(
    () => todas
      .filter((d) => (filtro === "clientes" ? d.mensagem_cliente : d.mensagem_transportadora))
      .sort((a, b) => (extras[a.id]?.rank ?? 1e9) - (extras[b.id]?.rank ?? 1e9)),
    [todas, filtro, extras],
  );
  const [sel, setSel] = useState<string | null>(null);
  const atual = lista.find((d) => d.id === sel) ?? lista[0] ?? null;

  return (
    <div className="card grid grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_340px]">
      <div className="border-b border-line md:border-b-0 md:border-r">
        <div className="flex gap-1 border-b border-line p-3">
          {(["clientes", "transportadoras"] as const).map((f) => (
            <button key={f} onClick={() => { setFiltro(f); setSel(null); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${filtro === f ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2"}`}>
              {f === "clientes" ? <MessageSquare size={14} /> : <Truck size={14} />}
              {f === "clientes" ? "Clientes" : "Transportadoras"}
              <span className="tabular text-muted">{todas.filter((d) => (f === "clientes" ? d.mensagem_cliente : d.mensagem_transportadora)).length}</span>
            </button>
          ))}
        </div>
        <ul className="max-h-[620px] divide-y divide-line overflow-y-auto">
          {lista.map((d) => {
            const st = d.nivel === "auto" ? "enviada" : d.nivel === "aprovacao" ? (aprov[d.id] === "aprovada" ? "enviada" : aprov[d.id] === "rejeitada" ? "rejeitada" : "aguardando aprovação") : "rascunho para pessoa";
            return (
              <li key={d.id}>
                <button onClick={() => setSel(d.id)} className={`w-full px-4 py-3 text-left hover:bg-surface-2 ${atual?.id === d.id ? "bg-accent-soft/60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{filtro === "clientes" ? `${d.marca} → ${d.cliente}` : `Chamado · ${d.transportadora}`}</span>
                    <span className={`text-[11px] ${st === "enviada" ? "text-good-ink" : "text-muted"}`}>{st}</span>
                  </div>
                  <div className="text-xs text-muted">{d.pedido} · {extras[d.id]?.tipo_rotulo}</div>
                  <div className="mt-1 line-clamp-1 text-sm text-ink-2">{filtro === "clientes" ? d.mensagem_cliente : d.mensagem_transportadora}</div>
                </button>
              </li>
            );
          })}
          {lista.length === 0 && <li className="p-10 text-center text-sm text-muted">Nenhuma mensagem ainda.</li>}
        </ul>
      </div>
      <div className="bg-surface-2 p-6">
        {atual && filtro === "clientes" && <Celular d={atual} digitando={false} aprovacao={aprov[atual.id] ?? null} />}
        {atual && filtro === "transportadoras" && (
          <div className="rounded-xl border border-line bg-surface p-4 text-sm">
            <div className="flex items-center gap-2 font-medium"><Truck size={15} /> Chamado para {atual.transportadora}</div>
            <div className="mt-1 text-xs text-muted">Pedido {atual.pedido}</div>
            <p className="mt-3 leading-relaxed text-ink-2">{atual.mensagem_transportadora}</p>
            <div className="mt-4 text-[11px] text-muted">Simulação: em produção, aberto no portal ou API da transportadora.</div>
          </div>
        )}
        {atual && <p className="mt-4 text-center text-xs text-muted">{atual.acao_rotulo}</p>}
      </div>
    </div>
  );
}
