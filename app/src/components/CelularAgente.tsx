"use client";
import { useEffect, useRef, useState } from "react";
import { X, Check, Loader2, AlertTriangle, Truck, Bot, CheckCheck, Clock, UserRound } from "lucide-react";
import type { Decisao, Evento } from "@/lib/agente/tipos";
import { salvarExecucao, marcarAprovacao, lerAprovacoes } from "@/lib/execucoes";
import { NIVEL } from "@/lib/format";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Passo = { rotulo: string; estado: "feito" | "correcao" | "erro" };

/** Moldura de celular genérica (sem marca de app real) com a conversa do cliente. */
export function Celular({ d, digitando, aprovacao }: { d: Decisao | null; digitando: boolean; aprovacao?: "aprovada" | "rejeitada" | null }) {
  const status =
    !d ? null : d.nivel === "auto" ? "enviada" : d.nivel === "aprovacao" ? (aprovacao === "aprovada" ? "enviada" : aprovacao === "rejeitada" ? "rejeitada" : "rascunho") : "rascunho";
  return (
    <div className="mx-auto w-[270px] rounded-[38px] border-[10px] border-[#1d1d1f] bg-[#1d1d1f] shadow-xl">
      <div className="relative overflow-hidden rounded-[28px] bg-[#efeae2]">
        <div className="flex items-center justify-between bg-[#f7f7f5] px-5 pb-1 pt-2 text-[10px] font-semibold text-ink">
          <span>9:41</span><span className="h-[14px] w-16 rounded-full bg-[#1d1d1f]" /><span>100%</span>
        </div>
        <div className="flex items-center gap-2 border-b border-black/5 bg-[#f7f7f5] px-3 pb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{d?.marca?.[0] ?? "?"}</div>
          <div className="leading-tight">
            <div className="text-[12px] font-semibold">{d ? d.marca : "…"}</div>
            <div className="text-[10px] text-muted">conta comercial</div>
          </div>
        </div>
        <div className="flex h-[360px] flex-col justify-end gap-2 p-3">
          <div className="self-center rounded-md bg-white/70 px-2 py-0.5 text-[10px] text-ink-2">Hoje</div>
          {digitando && (
            <div className="self-end rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[11px] text-ink-2">
              <span className="inline-flex gap-1"><span className="animate-bounce">•</span><span className="animate-bounce [animation-delay:.15s]">•</span><span className="animate-bounce [animation-delay:.3s]">•</span></span>
            </div>
          )}
          {d && d.mensagem_cliente && (
            <div className={`max-w-[92%] self-end rounded-xl rounded-tr-sm px-3 py-2 text-[11.5px] leading-snug shadow-sm ${status === "enviada" ? "bg-[#d9fdd3]" : "border border-dashed border-ink-2/40 bg-white/80"}`}>
              {d.mensagem_cliente}
              <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-muted">
                {status === "enviada" ? <>enviada <CheckCheck size={12} className="text-accent" /></> :
                 status === "rejeitada" ? <>rejeitada</> : <>rascunho · aguardando pessoa <Clock size={10} /></>}
              </div>
            </div>
          )}
          {d && !d.mensagem_cliente && <div className="self-center text-[10px] text-muted">sem mensagem ao cliente nesta ação</div>}
        </div>
      </div>
    </div>
  );
}

export default function CelularAgente({ id, onFechar }: { id: string; onFechar: () => void }) {
  const [passos, setPassos] = useState<Passo[]>([]);
  const [rodando, setRodando] = useState(true);
  const [modo, setModo] = useState<"ia" | "simulado" | null>(null);
  const [d, setD] = useState<Decisao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aprov, setAprov] = useState<"aprovada" | "rejeitada" | null>(null);
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    (async () => {
      try {
        const res = await fetch("/api/agente/fila", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (!res.body) throw new Error("sem resposta");
        const leitor = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const linhas = buf.split("\n");
          buf = linhas.pop() ?? "";
          for (const l of linhas) {
            if (!l.trim()) continue;
            const ev = JSON.parse(l) as Evento;
            await espera(ev.tipo === "ferramenta" ? 350 : 150);   // ritmo legível na tela
            if (ev.tipo === "inicio") setModo(ev.modo);
            if (ev.tipo === "ferramenta") setPassos((p) => [...p, { rotulo: ev.rotulo, estado: "feito" }]);
            if (ev.tipo === "correcao") setPassos((p) => [...p, { rotulo: `Política barrou a ação: ${ev.texto}`, estado: "correcao" }]);
            if (ev.tipo === "erro") setAviso(ev.texto);
            if (ev.tipo === "acao") {
              setPassos((p) => [...p, { rotulo: `Decidiu: ${ev.resultado.acao_rotulo}`, estado: "feito" }]);
              await espera(700);
              setD(ev.resultado);
              salvarExecucao(ev.resultado);
              setAprov(lerAprovacoes()[ev.resultado.id] ?? null);
            }
          }
        }
      } catch (err) {
        setAviso(`Não foi possível rodar o agente: ${(err as Error).message}`);
      } finally {
        setRodando(false);
      }
    })();
  }, [id]);

  const decidir = (s: "aprovada" | "rejeitada") => { if (!d) return; marcarAprovacao(d.id, s); setAprov(s); };

  return (
    <aside className="slide-in fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-y-auto border-l border-line bg-surface-2 shadow-2xl sm:max-w-[400px] lg:right-[520px] lg:z-40 lg:shadow-none">
      <header className="flex items-start justify-between px-5 pt-5">
        <div>
          <div className="flex items-center gap-2 font-semibold"><Bot size={18} className="text-accent" /> Agente de Fila</div>
          <div className="mt-0.5 text-xs text-muted">
            {rodando ? "trabalhando…" : modo === "simulado" || d?.simulado ? "modo simulado (sem IA)" : d ? `concluído · ${d.modelo}` : "concluído"}
          </div>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-surface"><X size={20} /></button>
      </header>

      <ol className="mx-5 mt-4 flex flex-col gap-2">
        {passos.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {p.estado === "correcao" ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-serious-ink" /> : <Check size={15} className="mt-0.5 shrink-0 text-good" />}
            <span className={p.estado === "correcao" ? "text-serious-ink" : "text-ink-2"}>{p.rotulo}</span>
          </li>
        ))}
        {rodando && <li className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> pensando…</li>}
      </ol>
      {aviso && <div className="mx-5 mt-3 rounded-lg bg-serious-soft px-3 py-2 text-xs text-serious-ink">{aviso}</div>}

      <div className="mt-5 px-5"><Celular d={d} digitando={rodando && passos.length > 2} aprovacao={aprov} /></div>

      {d && (
        <div className="mx-5 my-5 flex flex-col gap-3">
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="chip border border-line bg-surface text-ink-2"><span className="h-2 w-2 rounded-full" style={{ background: NIVEL[d.nivel].cor }} />{NIVEL[d.nivel].rotulo}</span>
            </div>
            <div className="mt-2 font-medium">{d.acao_rotulo}</div>
            <p className="mt-1 text-sm text-ink-2">{d.justificativa}</p>
            {d.nota_interna && <p className="mt-2 flex gap-2 text-sm text-ink-2"><UserRound size={14} className="mt-0.5 shrink-0" />{d.nota_interna}</p>}
            {d.nivel === "aprovacao" && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => decidir("aprovada")} className={`btn flex-1 justify-center ${aprov === "aprovada" ? "bg-good text-white" : "btn-primary"}`}>{aprov === "aprovada" ? "Aprovada" : "Aprovar e enviar"}</button>
                <button onClick={() => decidir("rejeitada")} className={`btn btn-ghost flex-1 justify-center ${aprov === "rejeitada" ? "border-critical text-critical" : ""}`}>{aprov === "rejeitada" ? "Rejeitada" : "Rejeitar"}</button>
              </div>
            )}
          </div>
          {d.mensagem_transportadora && (
            <div className="rounded-xl border border-line bg-surface p-4 text-sm">
              <div className="flex items-center gap-2 font-medium"><Truck size={15} /> Chamado para {d.transportadora}</div>
              <p className="mt-1 text-ink-2">{d.mensagem_transportadora}</p>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-muted">Simulação: em produção, a mensagem sairia pela API do WhatsApp e o chamado pelo portal da transportadora.</p>
        </div>
      )}
    </aside>
  );
}
