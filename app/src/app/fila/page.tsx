import { fila, linhaFila, resumo } from "@/lib/data";
import FilaTabela from "@/components/FilaTabela";
import PilotoAutomatico from "@/components/PilotoAutomatico";
import { n } from "@/lib/format";

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
        <p className="mt-2 max-w-3xl text-ink-2">
          A fila está ordenada pelo dinheiro que se perde se o caso esperar mais uma semana. Hoje o agente resolve
          {" "}<b className="text-ink">{n(resumo.niveis.auto)}</b> casos sozinho, e o time usa os 1.800 minutos do dia em
          {" "}<b className="text-ink">{aprov} aprovações</b> e <b className="text-ink">{time.length - aprov} casos que precisam de uma pessoa</b>.
        </p>
      </section>
      <PilotoAutomatico linhas={linhas} />
      <FilaTabela linhas={linhas} abrirInicial={abrir ?? null} />
    </div>
  );
}
