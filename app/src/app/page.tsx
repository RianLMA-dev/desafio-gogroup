import Link from "next/link";
import { ArrowRight, Calculator, Bot, Factory, ListOrdered, Play, ShieldCheck } from "lucide-react";
import { resumo, causas, robustez } from "@/lib/data";
import { mil, n, reais, NIVEL } from "@/lib/format";
import { BarrasCenarios, LinhaFilaRestante, Legenda } from "@/components/Graficos";

function Tile({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe: string; destaque?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-ink-2">{rotulo}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${destaque ? "text-accent-ink" : ""}`}>{valor}</div>
      <div className="mt-1 text-sm text-muted">{detalhe}</div>
    </div>
  );
}

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
      {/* Cabeçalho */}
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Visão geral · fila de 30/09/2026</div>
        <h1 className="mt-3 max-w-3xl text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">
          Com o agente, a operação recupera <span className="text-accent-ink">{mil(r.economia_agente)}</span> desta fila
          e zera as exceções em <span className="text-accent-ink">{c.agente.dias_para_zerar} dias úteis</span>, não {c.fifo.dias_para_zerar}.
          {" "}Corrigindo 9 causas na origem, evita outros <span className="text-accent-ink">{mil(r.causas_custo_mensal)} por mês</span>.
        </h1>
        <p className="mt-3 max-w-3xl text-ink-2">
          Hoje são {n(r.n_excecoes)} exceções abertas ({reais(r.valor_pedidos)} em pedidos), tratadas por ordem de chegada com capacidade
          de 150 por dia. Sem tratamento, a perda esperada chega a {mil(r.perda_sem_tratar_20d)} em 4 semanas, e os 150 casos mais urgentes
          esperariam, em média, {r.top150_espera_fifo.toFixed(0)} dias úteis na fila.
        </p>
      </section>

      {/* Comece por aqui */}
      <section className="card p-5">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Comece por aqui · 1 minuto</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { href: "/fila", n: 1, icone: ListOrdered, titulo: "Veja a fila do dia", texto: "O que tratar hoje, em ordem de dinheiro em risco, e quem trata cada caso." },
            { href: "/fila?abrir=EX0607", n: 2, icone: Play, titulo: "Rode o agente num pedido", texto: "Clique em “Rodar agente agora” e veja a IA investigar, decidir e escrever ao cliente." },
            { href: "/processo#imp02", n: 3, icone: Factory, titulo: "Veja um problema de processo", texto: "Uma impressora gera metade das falhas. Abra o relatório que o agente escreveu." },
          ].map(({ href, n: num, icone: Icone, titulo, texto }) => (
            <Link key={href} href={href} className="group flex gap-3 rounded-xl border border-line p-4 transition-colors hover:border-accent hover:bg-accent-soft/40">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">{num}</span>
              <div>
                <div className="flex items-center gap-1.5 font-medium"><Icone size={15} className="text-ink-2" />{titulo}<ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" /></div>
                <p className="mt-1 text-sm text-ink-2">{texto}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile rotulo="Recuperado nesta fila" valor={mil(r.economia_agente)} detalhe={`${Math.floor(pctRecuperado * 100)}% da perda que dava para evitar`} destaque />
        <Tile rotulo="Fila zera em" valor={`${c.agente.dias_para_zerar} dias úteis`} detalhe={`hoje: ${c.fifo.dias_para_zerar} dias úteis`} />
        <Tile rotulo="Tempo do time" valor={`−${Math.round(reducao * 100)}%`} detalhe={`${n(horasHoje)} h → ${n(horasAgente)} h para tratar a fila`} />
        <Tile rotulo="Evitável na origem, por mês" valor={mil(r.causas_custo_mensal)} detalhe={`≈ R$ ${Math.round((r.causas_custo_mensal * 12) / 1000)} mil por ano e ${Math.round(r.causas_horas_mes)} h do time por mês`} destaque />
      </section>

      {/* Cenários */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Perda evitável por estratégia</h2>
          <p className="mt-1 text-sm text-ink-2">Mesma fila, mesma capacidade do time. Só muda a ordem e quem trata.</p>
          <div className="mt-4">
            <BarrasCenarios dados={(["fifo", "prioridade", "agente"] as const).map((id) => ({ id, evitavel: c[id].evitavel }))} />
          </div>
          <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Outros {mil(r.perda_piso)} já estão comprometidos (dano que aconteceu antes de hoje) e nenhuma estratégia recupera.
            A perda evitável é o que ainda cresce a cada dia de espera.
          </p>
        </div>
        <div className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">Exceções ainda na fila, por dia útil</h2>
          <p className="mt-1 text-sm text-ink-2">
            O agente resolve {n(r.niveis.auto)} casos sozinho no primeiro dia; o time foca no resto. Sem o agente, as duas ordens
            esvaziam a fila no mesmo ritmo: muda só quem é atendido primeiro.
          </p>
          <div className="mt-3"><Legenda /></div>
          <div className="mt-2"><LinhaFilaRestante curvas={r.curvas} /></div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="card p-6">
        <h2 className="font-semibold">Como funciona</h2>
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 font-medium"><Calculator size={18} className="text-ink-2" /> Motor de cálculo</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Código, não IA. Calcula para cada exceção quanto dinheiro está em risco (cancelamento, reenvio, recompra perdida,
              contatos) e quanto esse risco cresce se ela esperar mais uma semana. Esse crescimento define a ordem da fila.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium"><Bot size={18} className="text-ink-2" /> Agente de Fila</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Investiga cada caso e decide: resolve sozinho ({n(r.niveis.auto)}), prepara para aprovação em 1 clique ({n(r.niveis.aprovacao)})
              ou passa para uma pessoa ({n(r.niveis.humano)}): pedidos acima de R$ 200, clientes VIP, extravios e rupturas.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium"><Factory size={18} className="text-ink-2" /> Agente de Processo</div>
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
          <h2 className="font-semibold">Problemas de processo</h2>
          <p className="mt-1 text-sm text-ink-2">
            Boa parte das exceções vem de poucas causas na origem. Elas custam <b className="text-ink">{mil(r.causas_custo_mensal)}/mês</b> e
            <b className="text-ink"> {Math.round(r.causas_horas_mes)} horas</b> do time por mês.
          </p>
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
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-ink-2" /> A conclusão se mantém se as premissas estiverem erradas?</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Rodamos o modelo inteiro de novo variando, uma de cada vez, as premissas mais incertas, e depois todas juntas no pior sentido.
          Em todos os casos, priorizar e usar o agente recupera mais de 90% da perda evitável e zera a fila em menos da metade do tempo.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-normal">Cenário</th>
                <th className="py-2 text-right font-normal">Recuperado com o agente</th>
                <th className="py-2 text-right font-normal">% do evitável</th>
                <th className="py-2 text-right font-normal">Fila zera (vs. hoje)</th>
              </tr>
            </thead>
            <tbody>
              {robustez.map((x) => (
                <tr key={x.id} className={`border-b border-line last:border-0 ${x.id === "base" || x.id === "pessimista" ? "font-medium" : ""}`}>
                  <td className="py-2 pr-4">{x.rotulo}</td>
                  <td className="tabular py-2 text-right">{mil(x.economia_agente)}</td>
                  <td className="tabular py-2 text-right">{x.pct_recuperado !== null ? `${Math.floor(x.pct_recuperado * 100)}%` : "—"}</td>
                  <td className="tabular py-2 text-right text-ink-2">{x.dias_agente} dias ({x.dias_fifo})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Premissas */}
      <section className="card p-5">
        <details>
          <summary className="cursor-pointer font-semibold">Premissas do cálculo ({r.premissas.length})</summary>
          <p className="mt-2 text-sm text-ink-2">Regras que não estão nos parâmetros do negócio e foram definidas para fechar o cálculo.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            {r.premissas.map((p) => <li key={p.id}>{p.texto}</li>)}
          </ol>
        </details>
      </section>
    </div>
  );
}
