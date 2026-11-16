import { fila, linhaFila, resumo } from "@/lib/data";
import FilaTabela from "@/components/FilaTabela";
import PilotoAutomatico from "@/components/PilotoAutomatico";
import { n, NIVEL } from "@/lib/format";

export default async function FilaPage({ searchParams }: { searchParams: Promise<{ abrir?: string }> }) {
  const { abrir } = await searchParams;
  const linhas = fila.map(linhaFila);
  const time = linhas.filter((l) => l.dia_agente === 0 && l.nivel !== "auto");
  const aprov = time.filter((l) => l.nivel === "aprovacao").length;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Fila do dia · 30/09/2026</div>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">O que tratar hoje, e por quê</h1>
        <p className="mt-1 text-ink-2">Ordenada pelo dinheiro que se perde se o caso esperar mais uma semana.</p>
        <dl className="mt-4 grid max-w-2xl grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
          {[
            { v: resumo.niveis.auto, r: "resolvidos pelo agente", cor: NIVEL.auto.cor },
            { v: aprov, r: "aprovações para o time", cor: NIVEL.aprovacao.cor },
            { v: time.length - aprov, r: "casos para uma pessoa", cor: NIVEL.humano.cor },
          ].map((k) => (
            <div key={k.r} className="px-4 py-3">
              <dd className="tabular flex items-center gap-2 text-2xl font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: k.cor }} />{n(k.v)}</dd>
              <dt className="text-xs text-ink-2">{k.r} hoje</dt>
            </div>
          ))}
        </dl>
      </section>
      <PilotoAutomatico linhas={linhas} />
      <FilaTabela linhas={linhas} abrirInicial={abrir ?? null} />
    </div>
  );
}
