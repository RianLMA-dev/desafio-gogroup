import { Eye, Wrench, User } from "lucide-react";
import RelatorioIncidente from "@/components/RelatorioIncidente";
import MapaCausas from "@/components/MapaCausas";
import { causas, resumo, relatorios } from "@/lib/data";
import { mil, n } from "@/lib/format";
import { GraficoCausa } from "@/components/Graficos";

const SELO = /\s*\((Agente de Fila já faz|pessoa decide)\)\.?$/;
const temSelo = (a: string) => /Agente de Fila já faz/.test(a);
const semSelo = (a: string) => a.replace(SELO, ".").replace(/\.\.$/, ".");

export default function ProcessoPage() {
  const ativas = causas.filter((c) => !c.monitorar).sort((a, b) => b.custo_mensal - a.custo_mensal || b.n_casos - a.n_casos);
  const obs = causas.filter((c) => c.monitorar);
  const casosLigados = ativas.filter((c) => c.id !== "fila_velha").reduce((s, c) => s + c.casos_evitaveis, 0);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Problemas de processo · Agente de Processo</div>
        <h1 className="mt-3 max-w-3xl text-[28px] font-semibold leading-tight tracking-tight">
          {ativas.length} causas na origem geraram {n(casosLigados)} exceções evitáveis em 2 meses e custam {mil(resumo.causas_custo_mensal)} por mês
        </h1>
        <p className="mt-1 text-ink-2">Tratar caso a caso não resolve: elas voltam todo dia.</p>
        <details className="mt-2 max-w-3xl text-sm text-ink-2">
          <summary className="cursor-pointer text-xs font-medium text-ai-strong">Como o Agente de Processo encontra as causas</summary>
          <p className="mt-2">Compara cada tipo de exceção com cada máquina, turno, lote, transportadora e região. Só aponta o que está muito acima do normal,
          é estatisticamente significativo e tem explicação operacional. O custo conta só o excesso acima do normal.</p>
        </details>
      </section>

      <MapaCausas causas={causas} />

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

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
              {c.grafico ? (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{c.grafico.titulo}</h3>
                  <div className="mt-2"><GraficoCausa g={c.grafico} /></div>
                </div>
              ) : (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-2">{c.evidencia.map((ev) => <li key={ev}>{ev}</li>)}</ul>
              )}
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4">
                <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted"><Wrench size={13} /> Ação principal</h3>
                <p className="font-medium leading-snug">{semSelo(c.acoes[0])}</p>
                <div className="flex items-center gap-2 text-xs text-ink-2"><User size={13} /> {c.responsavel}</div>
                <div className="mt-auto pt-1"><RelatorioIncidente id={c.id} salvo={relatorios[c.id]} /></div>
              </div>
            </div>

            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm font-medium text-ink-2">Ver evidência e plano completo</summary>
              <div className="mt-3 grid grid-cols-1 gap-5 text-sm text-ink-2 lg:grid-cols-2">
                <div>
                  {c.grafico && <ul className="flex list-disc flex-col gap-1.5 pl-5">{c.evidencia.map((ev) => <li key={ev}>{ev}</li>)}</ul>}
                  <p className={c.grafico ? "mt-3" : ""}><b className="font-medium text-ink">Causa provável:</b> {c.causa_provavel}</p>
                </div>
                <ol className="flex list-decimal flex-col gap-1.5 pl-5">
                  {c.acoes.map((a) => (
                    <li key={a}>{semSelo(a)}{temSelo(a) && <span className="chip ml-2 border border-ai-line bg-ai-soft px-2 py-0 text-[11px] text-ai-strong">o agente já faz</span>}</li>
                  ))}
                </ol>
              </div>
            </details>
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
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Sem causa na origem: endereço divergente, devolução, pagamento pendente e extravio se espalham por igual. São tratados caso a caso pelo Agente de Fila.
          </p>
        </section>
      )}
    </div>
  );
}
