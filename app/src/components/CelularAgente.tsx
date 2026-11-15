"use client";
import { useEffect, useRef, useState } from "react";
import { X, Check, Loader2, AlertTriangle, Truck, CheckCheck, Clock, UserRound, MessageCircleReply, Image as ImageIcon } from "lucide-react";
import type { Decisao, Evento } from "@/lib/agente/tipos";
import { salvarExecucao, marcarAprovacao, lerAprovacoes } from "@/lib/execucoes";
import AgenteAvatar from "./AgenteAvatar";
import { NIVEL } from "@/lib/format";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Passo = { rotulo: string; estado: "feito" | "correcao"; achado?: string; instrucao?: string };
export type Fala = { autor: "agente" | "cliente"; texto: string; foto?: boolean };

/** Texto que aparece letra por letra (efeito de digitação). */
function Digitando({ texto, ativo }: { texto: string; ativo: boolean }) {
  const [n, setN] = useState(ativo ? 0 : texto.length);
  useEffect(() => {
    if (!ativo) { setN(texto.length); return; }
    setN(0);
    const passo = Math.max(1, Math.round(texto.length / 90));   // ~1,8 s por mensagem
    const t = setInterval(() => setN((x) => { if (x >= texto.length) { clearInterval(t); return x; } return x + passo; }), 20);
    return () => clearInterval(t);
  }, [texto, ativo]);
  return <>{texto.slice(0, n)}{n < texto.length && <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-ink-2 align-middle" />}</>;
}

/** Moldura de celular genérica (sem marca de app real) com a conversa do cliente. */
export function Celular({ d, digitando, aprovacao, conversa, animarUltima = false, clienteDigitando = false }: {
  d: Decisao | null; digitando: boolean; aprovacao?: "aprovada" | "rejeitada" | null;
  conversa?: Fala[]; animarUltima?: boolean; clienteDigitando?: boolean;
}) {
  const status =
    !d ? null : d.nivel === "auto" ? "enviada" : d.nivel === "aprovacao" ? (aprovacao === "aprovada" ? "enviada" : aprovacao === "rejeitada" ? "rejeitada" : "rascunho") : "rascunho";
  const falas: Fala[] = conversa ?? (d?.mensagem_cliente ? [{ autor: "agente", texto: d.mensagem_cliente }] : []);
  // mantém a conversa rolada até o fim enquanto as mensagens crescem (inclusive durante a digitação)
  const caixa = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = caixa.current, el = conteudo.current;
    if (!c || !el) return;
    const ro = new ResizeObserver(() => { c.scrollTop = c.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const Pontos = () => <span className="inline-flex gap-1"><span className="animate-bounce">•</span><span className="animate-bounce [animation-delay:.15s]">•</span><span className="animate-bounce [animation-delay:.3s]">•</span></span>;

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
        <div ref={caixa} className="flex h-[380px] flex-col overflow-y-auto p-3">
         <div ref={conteudo} className="mt-auto flex flex-col gap-2">
          <div className="self-center rounded-md bg-white/70 px-2 py-0.5 text-[10px] text-ink-2">Hoje</div>
          {falas.map((f, i) => {
            const ultima = i === falas.length - 1;
            if (f.autor === "cliente")
              return (
                <div key={i} className="max-w-[88%] self-start rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[11.5px] leading-snug shadow-sm">
                  {f.foto && <div className="mb-1.5 flex h-20 w-36 items-center justify-center gap-1 rounded-lg bg-[#d9d4cc] text-[10px] text-ink-2"><ImageIcon size={14} /> foto do produto</div>}
                  {f.texto}
                </div>
              );
            const enviada = i > 0 || status === "enviada";
            return (
              <div key={i} className={`max-w-[92%] self-end whitespace-pre-line rounded-xl rounded-tr-sm px-3 py-2 text-[11.5px] leading-snug shadow-sm ${enviada ? "bg-[#d9fdd3]" : "border border-dashed border-ink-2/40 bg-white/80"}`}>
                <Digitando texto={f.texto} ativo={animarUltima && ultima} />
                <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-muted">
                  {enviada ? <>enviada <CheckCheck size={12} className="text-accent" /></> :
                   status === "rejeitada" ? <>rejeitada</> : <>rascunho · aguardando pessoa <Clock size={10} /></>}
                </div>
              </div>
            );
          })}
          {clienteDigitando && <div className="self-start rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[11px] text-ink-2"><Pontos /></div>}
          {digitando && <div className="self-end rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[11px] text-ink-2"><Pontos /></div>}
          {d && falas.length === 0 && <div className="self-center text-[10px] text-muted">sem mensagem ao cliente nesta ação</div>}
         </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_CONVERSA: Record<string, string> = {
  resolvido: "Resolvido", aguardando_cliente: "Aguardando o cliente", em_andamento: "Em andamento", com_pessoa: "Passou para uma pessoa", aguardando_aprovacao: "Aguardando aprovação",
};

export default function CelularAgente({ id, onFechar }: { id: string; onFechar: () => void }) {
  const [passos, setPassos] = useState<Passo[]>([]);
  const [rodando, setRodando] = useState(true);
  const [modo, setModo] = useState<"ia" | "simulado" | null>(null);
  const [d, setD] = useState<Decisao | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aprov, setAprov] = useState<"aprovada" | "rejeitada" | null>(null);
  const [conversa, setConversa] = useState<Fala[]>([]);
  const [animar, setAnimar] = useState(false);
  const [simulando, setSimulando] = useState<"cliente" | "agente" | null>(null);
  const [rodadas, setRodadas] = useState<{ proximo_passo: string; status: string; modelo: string; simulado: boolean }[]>([]);
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
            await espera(ev.tipo === "ferramenta" ? 450 : 150);   // ritmo legível na tela
            if (ev.tipo === "inicio") setModo(ev.modo);
            if (ev.tipo === "ferramenta") setPassos((p) => [...p, { rotulo: ev.rotulo, estado: "feito", achado: ev.achado, instrucao: ev.instrucao }]);
            if (ev.tipo === "correcao") setPassos((p) => [...p, { rotulo: `Política barrou a ação: ${ev.texto}`, estado: "correcao" }]);
            if (ev.tipo === "erro") setAviso(ev.texto);
            if (ev.tipo === "acao") {
              setPassos((p) => [...p, { rotulo: `Decidiu: ${ev.resultado.acao_rotulo}`, estado: "feito" }]);
              await espera(600);
              setD(ev.resultado);
              setConversa(ev.resultado.mensagem_cliente ? [{ autor: "agente", texto: ev.resultado.mensagem_cliente }] : []);
              setAnimar(true);
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

  const simularResposta = async () => {
    if (!d || simulando) return;
    setSimulando("cliente"); setAnimar(false);
    try {
      const r = await fetch("/api/agente/conversa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, acao: d.acao, historico: conversa }),
      }).then((x) => x.json());
      if (r.erro) throw new Error(r.erro);
      await espera(400);
      setConversa((c) => [...c, r.cliente]);
      setSimulando("agente");
      await espera(1300);
      setConversa((c) => [...c, r.agente]);
      setAnimar(true);
      setRodadas((x) => [...x, { proximo_passo: r.proximo_passo, status: r.status, modelo: r.modelo, simulado: r.simulado }]);
    } catch (err) {
      setAviso(`Não foi possível simular a resposta: ${(err as Error).message}`);
    } finally {
      setSimulando(null);
    }
  };

  const ultimaRodada = rodadas[rodadas.length - 1];
  const enviada = d && (d.nivel === "auto" || aprov === "aprovada");
  const podeConversar = d && enviada && conversa.length > 0 && rodadas.length < 2 && ultimaRodada?.status !== "resolvido";

  return (
    <aside className="slide-in fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-y-auto border-l border-line bg-surface-2 shadow-2xl sm:max-w-[420px] lg:right-[520px] lg:z-40 lg:shadow-none">
      <header className="sticky top-0 z-10 flex items-start justify-between bg-surface-2 px-5 pb-2 pt-5">
        <div>
          <div className="flex items-center gap-2.5 font-semibold"><AgenteAvatar tipo="fila" tamanho={28} /> Agente de Fila</div>
          <div className="mt-0.5 text-xs text-muted">
            {rodando ? "investigando o caso…" : modo === "simulado" || d?.simulado ? "modo simulado (sem IA)" : d ? `concluído · ${d.modelo}` : "concluído"}
          </div>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-surface"><X size={20} /></button>
      </header>

      <ol className="mx-5 mt-2 flex flex-col gap-2.5">
        {passos.map((p, i) => (
          <li key={i} className="slide-in-up text-sm">
            <div className="flex items-start gap-2">
              {p.estado === "correcao" ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-serious-ink" /> : <Check size={15} className="mt-0.5 shrink-0 text-good" />}
              <span className={p.estado === "correcao" ? "text-serious-ink" : "text-ink-2"}>{p.rotulo}</span>
            </div>
            {p.achado && <div className="ml-[23px] mt-0.5 text-[13px] font-medium text-ink">{p.achado}</div>}
            {p.instrucao && (
              <div className="ml-[23px] mt-1.5 rounded-lg border border-ai-line bg-ai-soft px-3 py-2 text-[12.5px] text-ai-strong">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"><AgenteAvatar tipo="processo" tamanho={16} /> Instrução do Agente de Processo</div>
                {p.instrucao}
              </div>
            )}
          </li>
        ))}
        {rodando && <li className="flex items-center gap-2 text-sm text-ai-strong"><Loader2 size={15} className="animate-spin" /> pensando…</li>}
      </ol>
      {aviso && <div className="mx-5 mt-3 rounded-lg bg-serious-soft px-3 py-2 text-xs text-serious-ink">{aviso}</div>}

      <div className="mt-5 px-5">
        <Celular d={d} digitando={(rodando && passos.length > 2) || simulando === "agente"} aprovacao={aprov}
          conversa={d ? conversa : []} animarUltima={animar} clienteDigitando={simulando === "cliente"} />
      </div>

      {d && (
        <div className="mx-5 mt-4 flex flex-col items-center gap-2">
          {podeConversar && (
            <button onClick={simularResposta} disabled={!!simulando} className="btn btn-ghost w-full justify-center disabled:opacity-60">
              {simulando ? <Loader2 size={15} className="animate-spin" /> : <MessageCircleReply size={15} />}
              {simulando === "cliente" ? "Cliente respondendo…" : simulando === "agente" ? "Agente respondendo…" : rodadas.length ? "Simular outra resposta do cliente" : "Simular resposta do cliente"}
            </button>
          )}
          {d && !enviada && conversa.length > 0 && (
            <p className="text-center text-xs text-muted">
              {d.nivel === "aprovacao" ? "Aprove para enviar a mensagem e simular a resposta do cliente." : "Rascunho para uma pessoa do time revisar e enviar."}
            </p>
          )}
          {ultimaRodada && (
            <div className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-2">
              <b className="text-ink">{STATUS_CONVERSA[ultimaRodada.status] ?? ultimaRodada.status}:</b> {ultimaRodada.proximo_passo}
              <div className="mt-0.5 text-[10px] text-muted">cliente e agente simulados por {ultimaRodada.simulado ? "roteiro (sem IA)" : ultimaRodada.modelo}</div>
            </div>
          )}
        </div>
      )}

      {d && (
        <div className="mx-5 my-5 flex flex-col gap-3">
          <div className="rounded-xl border border-line bg-surface p-4">
            <span className="chip border border-line bg-surface text-ink-2"><span className="h-2 w-2 rounded-full" style={{ background: NIVEL[d.nivel].cor }} />{NIVEL[d.nivel].rotulo}</span>
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
          <p className="text-[11px] leading-relaxed text-muted">Simulação: em produção, a mensagem sairia pela API do WhatsApp e o chamado pelo portal da transportadora. A resposta do cliente é interpretada por IA, só para demonstração.</p>
        </div>
      )}
    </aside>
  );
}
