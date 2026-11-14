import { FileText, Eye, Wrench, User } from "lucide-react";
import { causas, resumo } from "@/lib/data";
import { mil, n } from "@/lib/format";
import { GraficoCausa } from "@/components/Graficos";

export default function ProcessoPage() {
  const ativas = causas.filter((c) => !c.monitorar).sort((a, b) => b.custo_mensal - a.custo_mensal || b.n_casos - a.n_casos);
  const obs = causas.filter((c) => c.monitorar);
  const casosLigados = ativas.filter((c) => c.id !== "fila_velha").reduce((s, c) => s + c.casos_evitaveis, 0);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Problemas de processo · Agente de Processo</div>
        <h1 className="mt-3 max-w-3xl text-[28px] font-semibold leading-tight tracking-tight">
          {ativas.length} causas na origem geram {n(casosLigados)} exceções evitáveis e custam {mil(resumo.causas_custo_mensal)} por mês
        </h1>
        <p className="mt-2 max-w-3xl text-ink-2">
          Tratar caso a caso não resolve: elas voltam todo dia. O Agente de Processo compara cada tipo de exceção com cada máquina, turno, lote,
          transportadora e região, e só aponta o que está muito acima do normal, é estatisticamente significativo e tem uma explicação operacional.
          O custo considera só o excesso acima do normal, já descontado o que aconteceria de qualquer forma.
        </p>
      </section>

      <div className="flex flex-col gap-4">
        {ativas.map((c) => (
          <article key={c.id} id={c.id} className="card scroll-mt-6 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{c.categoria}</div>
                <h2 className="mt-1 text-lg font-semibold">{c.titulo}</h2>
                <p className="mt-1 max-w-2xl text-sm text-ink-2">{c.resumo}</p>
              </div>
              <div className="flex shrink-0 gap-6 sm:text-right">
                {c.custo_mensal > 0 && <div><div className="tabular text-xl font-semibold">{mil(c.custo_mensal)}</div><div className="text-xs text-muted">por mês</div></div>}
                {c.horas_time_mes > 0 && <div><div className="tabular text-xl font-semibold">{Math.round(c.horas_time_mes)} h</div><div className="text-xs text-muted">do time por mês</div></div>}
                <div><div className="tabular text-xl font-semibold">{n(c.n_casos)}</div><div className="text-xs text-muted">exceções abertas</div></div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium">Evidência</h3>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-2">
                  {c.evidencia.map((ev) => <li key={ev}>{ev}</li>)}
                </ul>
                <h3 className="mt-4 text-sm font-medium">Causa provável</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{c.causa_provavel}</p>
              </div>
              {c.grafico && (
                <div>
                  <h3 className="text-sm font-medium">{c.grafico.titulo}</h3>
                  <div className="mt-2"><GraficoCausa g={c.grafico} /></div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-4 border-t border-line pt-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium"><Wrench size={15} className="text-ink-2" /> O que fazer</h3>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-2">
                  {c.acoes.map((a) => <li key={a}>{a}</li>)}
                </ol>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted"><User size={13} /> Responsável: {c.responsavel}</div>
              </div>
              <button disabled className="btn btn-ghost shrink-0 opacity-50" title="Disponível na próxima etapa">
                <FileText size={15} /> Gerar relatório de incidente
              </button>
            </div>
          </article>
        ))}
      </div>

      {obs.length > 0 && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Eye size={18} className="text-ink-2" /> Em observação</h2>
          {obs.map((c) => (
            <div key={c.id} className="mt-3 text-sm">
              <div className="font-medium">{c.titulo}</div>
              <p className="mt-1 text-ink-2">{c.resumo}</p>
            </div>
          ))}
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Sem causa na origem: endereço divergente, devolução pela transportadora, pagamento pendente e extravio se distribuem de forma
            uniforme entre CDs, turnos, máquinas, lotes, marcas e clientes. Os “sinais” que apareceram eram efeito de composição
            (só temos pedidos com exceção) ou acaso de muitas comparações. Esses casos são tratados um a um pelo Agente de Fila.
          </p>
        </section>
      )}
    </div>
  );
}
