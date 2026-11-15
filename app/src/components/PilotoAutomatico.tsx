"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, X, Check, Loader2, Truck, MessageSquare, Clock, UserRound, Factory } from "lucide-react";
import type { LinhaFila } from "@/lib/data";
import type { Decisao, Evento } from "@/lib/agente/tipos";
import { salvarExecucao, lerExecucoes } from "@/lib/execucoes";
import { reais, NIVEL } from "@/lib/format";
import AgenteAvatar from "./AgenteAvatar";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LIMITE = 10;

type Item = {
  linha: LinhaFila; estado: "fila" | "rodando" | "feito" | "erro";
  passos: string[]; achado?: string; instrucao?: boolean; d?: Decisao; aviso?: string;
};

/** Painel em que o agente trata, ao vivo e um após o outro, os próximos casos da fila dele. */
export function PainelPiloto({ casos, onFechar }: { casos: LinhaFila[]; onFechar: () => void }) {
  const [itens, setItens] = useState<Item[]>(() => casos.map((linha) => ({ linha, estado: "fila", passos: [] })));
  const [pausado, setPausado] = useState(false);
  const pausaRef = useRef(false);
  const fechadoRef = useRef(false);
  const iniciou = useRef(false);

  const atualizar = (i: number, f: (x: Item) => Item) => setItens((xs) => xs.map((x, j) => (j === i ? f(x) : x)));

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    (async () => {
      for (let i = 0; i < casos.length; i++) {
        while (pausaRef.current && !fechadoRef.current) await espera(300);
        if (fechadoRef.current) return;
        atualizar(i, (x) => ({ ...x, estado: "rodando" }));
        try {
          const res = await fetch("/api/agente/fila", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: casos[i].id }) });
          const leitor = res.body!.getReader();
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
              if (ev.tipo === "ferramenta") {
                await espera(250);
                atualizar(i, (x) => ({ ...x, passos: [...x.passos, ev.rotulo], achado: ev.instrucao || ev.nome === "verificar_prazo" ? ev.achado : x.achado, instrucao: x.instrucao || Boolean(ev.instrucao) }));
              }
              if (ev.tipo === "erro") atualizar(i, (x) => ({ ...x, aviso: ev.texto }));
              if (ev.tipo === "acao") { salvarExecucao(ev.resultado); atualizar(i, (x) => ({ ...x, estado: "feito", d: ev.resultado })); }
            }
          }
          atualizar(i, (x) => (x.estado === "rodando" ? { ...x, estado: "erro", aviso: x.aviso ?? "sem decisão" } : x));
        } catch (err) {
          atualizar(i, (x) => ({ ...x, estado: "erro", aviso: (err as Error).message }));
        }
        await espera(1200);
      }
    })();
    return () => { fechadoRef.current = true; };
  }, [casos]);

  const feitos = itens.filter((x) => x.estado === "feito" && x.d);
  const risco = feitos.reduce((s, x) => s + x.linha.score, 0);
  const enviadas = feitos.filter((x) => x.d!.nivel === "auto" && x.d!.mensagem_cliente).length;
  const chamados = feitos.filter((x) => x.d!.mensagem_transportadora).length;
  const aprov = feitos.filter((x) => x.d!.nivel === "aprovacao").length;
  const pessoa = feitos.filter((x) => x.d!.nivel === "humano").length;
  const rodando = itens.some((x) => x.estado === "rodando" || x.estado === "fila");
  const alternarPausa = () => { pausaRef.current = !pausaRef.current; setPausado(pausaRef.current); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <div className="flex items-center gap-2.5 font-semibold"><AgenteAvatar tipo="fila" tamanho={28} /> Piloto automático</div>
            <p className="mt-1 text-sm text-ink-2">O Agente de Fila trata, ao vivo, os próximos {casos.length} casos da fila dele, um após o outro. Ações sem custo ele executa; reenvios ficam para aprovação.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {rodando && <button onClick={alternarPausa} className="btn btn-ghost">{pausado ? <><Play size={15} /> Continuar</> : <><Pause size={15} /> Pausar</>}</button>}
            <button onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-surface-2"><X size={20} /></button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-5">
          {[
            { r: "Casos tratados", v: `${feitos.length}/${casos.length}` },
            { r: "Risco evitado na semana", v: reais(risco) },
            { r: "Mensagens enviadas", v: String(enviadas), i: MessageSquare },
            { r: "Chamados abertos", v: String(chamados), i: Truck },
            { r: "Para aprovar / pessoa", v: `${aprov} / ${pessoa}`, i: Clock },
          ].map((k, i) => (
            <div key={k.r} className={`bg-surface px-4 py-3 ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
              <div className="text-xs text-ink-2">{k.r}</div>
              <div className="tabular mt-0.5 text-xl font-semibold">{k.v}</div>
            </div>
          ))}
        </div>

        <ol className="flex-1 divide-y divide-line overflow-y-auto">
          {itens.map((x) => (
            <li key={x.linha.id} className={`px-5 py-3 ${x.estado === "rodando" ? "bg-ai-soft/60" : ""} ${x.estado === "fila" ? "opacity-50" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {x.estado === "rodando" ? <Loader2 size={16} className="animate-spin text-ai" /> :
                   x.estado === "feito" ? <Check size={16} className="text-good" /> :
                   x.estado === "erro" ? <X size={16} className="text-critical" /> : <span className="block h-4 w-4 rounded-full border border-line-strong" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{x.linha.pedido}</span>
                    <span className="text-ink-2">{x.linha.tipo_rotulo}</span>
                    <span className="tabular text-xs text-muted">#{x.linha.rank} · risco +{reais(x.linha.score)}</span>
                  </div>
                  {x.estado === "rodando" && <div className="mt-1 text-xs text-ink-2">{x.passos[x.passos.length - 1] ?? "Começando a investigar"}…</div>}
                  {x.achado && x.estado !== "fila" && (
                    <div className="mt-1 flex items-start gap-1.5 text-xs text-ink-2">{x.instrucao && <Factory size={12} className="mt-0.5 shrink-0 text-ai" />}{x.achado}</div>
                  )}
                  {x.d && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="chip border border-line text-ink-2"><span className="h-2 w-2 rounded-full" style={{ background: NIVEL[x.d.nivel].cor }} />{NIVEL[x.d.nivel].curto}</span>
                        <span>{x.d.acao_rotulo}</span>
                      </div>
                      {x.d.mensagem_cliente && <div className="line-clamp-2 text-xs text-ink-2"><MessageSquare size={11} className="mr-1 inline" />{x.d.mensagem_cliente}</div>}
                      {x.d.nivel === "humano" && x.d.nota_interna && <div className="line-clamp-1 text-xs text-ink-2"><UserRound size={11} className="mr-1 inline" />{x.d.nota_interna}</div>}
                    </div>
                  )}
                  {x.aviso && <div className="mt-1 text-[11px] text-serious-ink">{x.aviso}</div>}
                </div>
                {x.d && <span className="shrink-0 text-[10px] text-muted">{x.d.simulado ? "sem IA" : x.d.modelo.split("/").pop()}</span>}
              </div>
            </li>
          ))}
        </ol>
        <footer className="border-t border-line px-5 py-3 text-[11px] text-muted">
          {rodando ? "O ritmo respeita o limite gratuito da API de IA (alguns casos por minuto)." : "Pronto. Os resultados aparecem em Ações do agente e Mensagens."}
        </footer>
      </div>
    </div>
  );
}

/** Faixa com o botão que abre o piloto automático. */
export default function PilotoAutomatico({ linhas }: { linhas: LinhaFila[] }) {
  const [casos, setCasos] = useState<LinhaFila[] | null>(null);
  const iniciar = () => {
    const ja = lerExecucoes();
    const proximos = linhas
      .filter((l) => l.dia_agente === 0 && (l.nivel === "auto" || l.nivel === "aprovacao") && !ja[l.id])
      .sort((a, b) => a.rank - b.rank)
      .slice(0, LIMITE);
    setCasos(proximos);
  };
  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-ai-line bg-ai-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AgenteAvatar tipo="fila" tamanho={32} />
          <div>
            <div className="font-medium">Deixe o agente trabalhar</div>
            <div className="text-sm text-ink-2">Ele trata ao vivo os próximos {LIMITE} casos da fila dele, mais urgentes primeiro, e você acompanha cada decisão.</div>
          </div>
        </div>
        <button onClick={iniciar} className="btn btn-ai shrink-0 justify-center"><Play size={15} /> Iniciar piloto automático</button>
      </div>
      {casos && <PainelPiloto casos={casos} onFechar={() => setCasos(null)} />}
    </>
  );
}
