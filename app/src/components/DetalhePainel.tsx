"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Crown, Sparkles, AlertTriangle, Factory, Play } from "lucide-react";
import type { Excecao } from "@/lib/data";
import { reais, reaisC, data, NIVEL } from "@/lib/format";
import CelularAgente from "./CelularAgente";

type Detalhe = Excecao & { causas_titulos: { id: string; titulo: string }[] };

const COMPONENTES: { k: keyof Excecao["comp"]; rotulo: string }[] = [
  { k: "cancelamento", rotulo: "Cancelamento (reembolso)" },
  { k: "resolucao", rotulo: "Custo de resolver (reenvio, frete)" },
  { k: "recompra", rotulo: "Recompra perdida" },
  { k: "contatos", rotulo: "Contatos no atendimento" },
  { k: "venda", rotulo: "Venda não recuperada" },
];

function Linha({ r, v }: { r: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-ink-2">{r}</span><span className="text-right">{v}</span>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-5 py-4">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.1em] text-muted">{titulo}</h3>
      {children}
    </section>
  );
}

export default function DetalhePainel({ id, onFechar }: { id: string; onFechar: () => void }) {
  const [e, setE] = useState<Detalhe | null>(null);
  const [agente, setAgente] = useState(0);   // muda a cada execução para reiniciar o painel
  useEffect(() => {
    setE(null);
    fetch(`/api/excecao/${id}`).then((r) => r.json()).then(setE);
  }, [id]);
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && (agente ? setAgente(0) : onFechar());
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar, agente]);

  const comps = e ? COMPONENTES.filter((c) => e.comp[c.k] > 0.005) : [];
  const maxComp = e ? Math.max(...comps.map((c) => e.comp[c.k]), 1) : 1;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/25" onClick={onFechar} />
      <aside className="slide-in relative flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-surface shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-surface px-5 pb-3 pt-5">
          {e ? (
            <div>
              <div className="text-xs text-muted">#{e.rank} na fila · {e.id}</div>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">{e.pedido}{e.vip && <Crown size={16} className="text-serious-ink" aria-label="Cliente VIP" />}</h2>
              <div className="mt-1 text-sm text-ink-2">{e.tipo_rotulo} · {e.marca}</div>
            </div>
          ) : <div className="h-16" />}
          <button onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 hover:bg-surface-2"><X size={20} /></button>
        </header>

        {!e ? <div className="p-5 text-sm text-muted">Carregando…</div> : (
          <>
            {/* Decisão do agente */}
            <section className="mx-5 mb-4 rounded-xl border border-line bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="chip border border-line bg-surface text-ink-2"><span className="h-2 w-2 rounded-full" style={{ background: NIVEL[e.nivel].cor }} />{NIVEL[e.nivel].rotulo}</span>
                {e.nivel !== "humano" && <span className="flex items-center gap-1 text-xs text-accent-ink"><Sparkles size={12} /> decisão do agente</span>}
              </div>
              <div className="mt-3 font-medium">{e.acao_texto}</div>
              <div className="mt-1 text-sm text-ink-2">{e.motivo_nivel}.</div>
              <button onClick={() => setAgente(Date.now())} className="btn btn-primary mt-4 w-full justify-center">
                <Play size={15} /> Rodar agente agora
              </button>
            </section>

            <Bloco titulo="Por que está nesta posição">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line p-3">
                  <div className="text-xs text-ink-2">Perda esperada hoje</div>
                  <div className="tabular mt-1 text-lg font-semibold">{reaisC(e.perda_hoje)}</div>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <div className="text-xs text-ink-2">Se esperar mais 1 semana</div>
                  <div className="tabular mt-1 text-lg font-semibold text-serious-ink">+{reaisC(e.score)}</div>
                </div>
              </div>
              {comps.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-xs text-muted">De onde vem a perda de hoje</div>
                  {comps.map((c) => (
                    <div key={c.k} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-sm">
                      <span className="text-ink-2">{c.rotulo}</span>
                      <span className="tabular">{reaisC(e.comp[c.k])}</span>
                      <div className="col-span-2 mt-1 h-1.5 rounded bg-surface-2">
                        <div className="h-1.5 rounded bg-accent" style={{ width: `${(e.comp[c.k] / maxComp) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Na ordem de chegada, este caso seria tratado no dia útil {e.dia_fifo + 1}. Com priorização e agente, no dia {e.dia_agente + 1}.
              </p>
            </Bloco>

            {e.causas_titulos.length > 0 && (
              <Bloco titulo="Ligado a problema de processo">
                {e.causas_titulos.map((c) => (
                  <Link key={c.id} href={`/processo#${c.id}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2">
                    <Factory size={15} className="text-accent" /> {c.titulo}
                  </Link>
                ))}
              </Bloco>
            )}

            <Bloco titulo="Prazo">
              {e.falso_atraso && (
                <div className="mb-2 flex items-start gap-2 rounded-lg bg-serious-soft px-3 py-2 text-sm text-serious-ink">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  Não está atrasado de verdade: a data prometida foi calculada em dias corridos.
                </div>
              )}
              <Linha r="Pedido feito em" v={data(e.data_pedido)} />
              <Linha r="Data prometida ao cliente" v={data(e.data_prometida)} />
              <Linha r="Prazo correto (dias úteis)" v={data(e.prazo_correto)} />
              <Linha r="Entregue em" v={data(e.data_entrega)} />
              <Linha r="Atraso que o cliente percebe" v={`${Math.max(0, e.atraso_prometido)} dias úteis`} />
              <Linha r="Exceção aberta há" v={`${e.dias_aberta} dias úteis`} />
            </Bloco>

            <Bloco titulo="Cliente">
              <Linha r="Pedidos feitos" v={e.cli_pedidos} />
              <Linha r="Receita acumulada" v={<>{reais(e.cli_receita)}{e.vip && <span className="ml-2 text-xs text-serious-ink">VIP</span>}</>} />
              <Linha r="Contatos no atendimento (12 meses)" v={e.cli_contatos} />
            </Bloco>

            <Bloco titulo="Pedido">
              <Linha r="Produto" v={e.produto} />
              <Linha r="Valor · itens" v={`${reais(e.valor)} · ${e.itens} ${e.itens > 1 ? "itens" : "item"}${e.brinde ? " + brinde" : ""}`} />
              <Linha r="Transportadora" v={`${e.transportadora} (SLA ${e.sla} dias úteis)`} />
              <Linha r="Destino" v={`${e.cidade} · ${e.uf}`} />
              <Linha r="Separação" v={`${e.cd} · turno da ${e.turno}`} />
              {e.maquina && <Linha r="Impressora" v={e.maquina} />}
              <Linha r="Lote" v={e.lote} />
              <Linha r="Status atual" v={e.status.replaceAll("_", " ")} />
            </Bloco>
          </>
        )}
      </aside>
      {agente > 0 && <CelularAgente key={agente} id={id} onFechar={() => setAgente(0)} />}
    </div>
  );
}
