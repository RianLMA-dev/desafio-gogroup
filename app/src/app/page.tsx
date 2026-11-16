import Link from "next/link";
import { ArrowRight, Calculator, Factory, ListOrdered, Play, ShieldCheck } from "lucide-react";
import { resumo, causas, robustez } from "@/lib/data";
import { mil, n, reais, NIVEL } from "@/lib/format";
import { BarrasCenarios, LinhaFilaRestante, Legenda, BarrasRobustez } from "@/components/Graficos";
import Contador from "@/components/Contador";
import AgenteAvatar from "@/components/AgenteAvatar";

export default function VisaoGeral() {
  const r = resumo;
  const c = r.cenarios;
  const pctRecuperado = r.economia_agente / c.fifo.evitavel;
  const horasHoje = Math.round(r.minutos_time_hoje / 60);
  const horasAgente = Math.round(r.minutos_time_agente / 60);
  const reducao = 1 - r.minutos_time_agente / r.minutos_time_hoje;
  const topCausas = causas.filter((x) => x.custo_mensal > 0).sort((a, b) => b.custo_mensal - a.custo_mensal).slice(0, 3);
  const tipos = [...r.por_tipo].sort((a, b) => b.perda_hoje - a.perda_hoje);
  const maxN = Math.max(...tipos.map((t) => t.n));

  return (
    <div className="flex flex-col gap-8">
      {/* Destaque */}
      <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.16] blur-3xl" style={{ background: "linear-gradient(135deg, var(--accent), var(--ai))" }} />
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Visão geral · fila de 30/09/2026</div>
            <div className="mt-5 text-sm font-medium text-ink-2">Recuperado nesta fila com priorização e o Agente de Fila</div>
            <div className="mt-1 text-[44px] font-semibold leading-none tracking-tight text-accent-ink sm:text-[64px]">
              <Contador valor={r.economia_agente} formato="mil" />
            </div>
            <p className="mt-3 text-[15px] text-ink-2"><b className="font-semibold text-ink">{Math.floor(pctRecuperado * 100)}%</b> da perda que dava para evitar</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-2">
              <span className="chip border border-line bg-surface">{n(r.n_excecoes)} exceções abertas</span>
              <span className="chip border border-line bg-surface">{mil(r.valor_pedidos)} em pedidos</span>
              <span className="chip border border-line bg-surface">sem tratar: {mil(r.perda_sem_tratar_20d)} perdidos em 4 semanas</span>
            </div>
          </div>
          <dl className="grid grid-cols-1 divide-y divide-line rounded-xl border border-line bg-surface/80 backdrop-blur sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
            <div className="px-4 py-3">
              <dt className="text-xs text-ink-2">Fila zera em</dt>
              <dd className="mt-0.5 text-2xl font-semibold tracking-tight"><Contador valor={c.agente.dias_para_zerar} /> dias úteis <span className="text-sm font-normal text-muted">(hoje: {c.fifo.dias_para_zerar})</span></dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs text-ink-2">Tempo do time para tratar a fila</dt>
              <dd className="mt-0.5 text-2xl font-semibold tracking-tight"><Contador valor={reducao * 100} formato="porcento_neg" /> <span className="text-sm font-normal text-muted">({n(horasHoje)} h → {n(horasAgente)} h)</span></dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs text-ink-2">Evitável na origem, corrigindo 9 causas</dt>
              <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-accent-ink"><Contador valor={r.causas_custo_mensal} formato="mil" /><span className="text-base">/mês</span> <span className="text-sm font-normal text-muted">(≈ R$ {Math.round((r.causas_custo_mensal * 12) / 1000)} mil/ano)</span></dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Comece por aqui */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Comece por aqui · 1 minuto</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { href: "/fila", n: 1, icone: ListOrdered, titulo: "Veja a fila do dia", texto: "O que tratar hoje, em ordem de dinheiro em risco, e quem trata cada caso.", ia: false },
            { href: "/fila?abrir=EX0607", n: 2, icone: Play, titulo: "Rode o agente num pedido", texto: "Clique em “Rodar agente agora” e veja a IA investigar, decidir e escrever ao cliente.", ia: true },
            { href: "/processo#imp02", n: 3, icone: Factory, titulo: "Veja um problema de processo", texto: "Uma impressora gera mais da metade das falhas. Abra o relatório que o agente escreveu.", ia: false },
          ].map(({ href, n: num, icone: Icone, titulo, texto, ia }) => (
            <Link key={href} href={href} className={`card group flex gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${ia ? "border-ai-line hover:border-ai" : "hover:border-accent"}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${ia ? "bg-ai" : "bg-accent"}`}>{num}</span>
              <div>
                <div className="flex items-center gap-1.5 font-medium"><Icone size={15} className={ia ? "text-ai" : "text-ink-2"} />{titulo}<ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" /></div>
                <p className="mt-1 text-sm text-ink-2">{texto}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Cenários */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Perda evitável por estratégia</h2>
          <p className="mt-1 text-sm text-ink-2">Mesma fila e mesmo time; muda a ordem e quem trata.</p>
          <div className="mt-4">
            <BarrasCenarios dados={(["fifo", "prioridade", "agente"] as const).map((id) => ({ id, evitavel: c[id].evitavel }))} />
          </div>
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Não inclui {mil(r.perda_piso)} já perdidos antes de hoje.</p>
        </div>
        <div className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">Exceções ainda na fila, por dia útil</h2>
          <p className="mt-1 text-sm text-ink-2">O agente resolve {n(r.niveis.auto)} casos já no primeiro dia.</p>
          <div className="mt-3"><Legenda /></div>
          <div className="mt-2"><LinhaFilaRestante curvas={r.curvas} /></div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="card p-6">
        <h2 className="font-semibold">Como funciona</h2>
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 font-medium"><span className="flex h-6 w-6 items-center justify-center rounded-[30%] bg-surface-2 text-ink-2"><Calculator size={14} /></span> Motor de cálculo</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Código, não IA. Calcula para cada exceção quanto dinheiro está em risco (cancelamento, reenvio, recompra perdida,
              contatos) e quanto esse risco cresce se ela esperar mais uma semana. Esse crescimento define a ordem da fila.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium"><AgenteAvatar tipo="fila" tamanho={24} /> Agente de Fila</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Investiga cada caso e decide: resolve sozinho ({n(r.niveis.auto)}), prepara para aprovação em 1 clique ({n(r.niveis.aprovacao)})
              ou passa para uma pessoa ({n(r.niveis.humano)}): pedidos acima de R$ 200, clientes VIP, extravios e rupturas.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium"><AgenteAvatar tipo="processo" tamanho={24} /> Agente de Processo</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Procura padrões na fila inteira — máquina, turno, lote, transportadora — e escreve relatórios de incidente com evidência,
              custo e ação. O que ele descobre muda a ação do Agente de Fila.
            </p>
          </div>
        </div>
        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          A fila foi processada em lote pelos agentes (como seria de madrugada em produção). Em cada pedido e incidente, o botão
          “Rodar agente agora” executa o agente ao vivo. As ações são simuladas: em produção, seriam integrações com WhatsApp, transportadoras e ERP.
        </p>
      </section>

      {/* Por tipo + processo */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">Onde está o risco, por tipo de exceção</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
            {(["auto", "aprovacao", "humano"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: NIVEL[k].cor }} />{NIVEL[k].rotulo}</span>
            ))}
          </div>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-normal">Tipo</th>
                <th className="py-2 text-right font-normal">Casos</th>
                <th className="hidden py-2 pl-4 font-normal sm:table-cell">Quem trata</th>
                <th className="py-2 text-right font-normal">Risco hoje</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.tipo} className="border-b border-line last:border-0">
                  <td className="py-2">{t.rotulo}</td>
                  <td className="tabular py-2 text-right text-ink-2">{t.n}</td>
                  <td className="hidden py-2 pl-4 sm:table-cell">
                    <div className="flex h-2.5 gap-[2px]" style={{ width: `${(t.n / maxN) * 100}%` }} title={`${t.auto} agente · ${t.aprovacao} aprovação · ${t.humano} pessoa`}>
                      {(["auto", "aprovacao", "humano"] as const).map((k) => t[k] > 0 && (
                        <div key={k} className="first:rounded-l last:rounded-r" style={{ flex: t[k], background: NIVEL[k].cor }} />
                      ))}
                    </div>
                  </td>
                  <td className="tabular py-2 text-right">{reais(t.perda_hoje)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card flex flex-col p-5 lg:col-span-2">
          <h2 className="font-semibold">Maiores causas na origem</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {topCausas.map((x) => (
              <li key={x.id} className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0">
                <div>
                  <div className="text-sm font-medium">{x.titulo}</div>
                  <div className="text-xs text-muted">{x.categoria}</div>
                </div>
                <div className="tabular whitespace-nowrap text-sm font-medium">{mil(x.custo_mensal)}/mês</div>
              </li>
            ))}
          </ul>
          <Link href="/processo" className="btn btn-ghost mt-auto self-start">Ver os {causas.filter((x) => !x.monitorar).length} problemas <ArrowRight size={16} /></Link>
        </div>
      </section>

      {/* Robustez */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-ink-2" /> E se as premissas estiverem erradas?</h2>
        <p className="mt-1 text-sm text-ink-2">Mesmo com todas no pior sentido, a solução recupera mais de 90% do evitável.</p>
        <div className="mt-4"><BarrasRobustez dados={robustez} /></div>
      </section>

      {/* Premissas */}
      <section className="card p-5">
        <details>
          <summary className="cursor-pointer font-semibold">Premissas do cálculo ({r.premissas.length})</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            {r.premissas.map((p) => <li key={p.id}>{p.texto}</li>)}
          </ol>
        </details>
      </section>
    </div>
  );
}
