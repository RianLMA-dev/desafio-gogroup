import { lote, fila } from "@/lib/data";
import AcoesLista from "@/components/AcoesLista";
import { n } from "@/lib/format";
import { ShieldCheck } from "lucide-react";

export default function AcoesPage() {
  // dados de todas as exceções, para também mostrar execuções ao vivo de qualquer caso
  const extras = Object.fromEntries(fila.map((e) => [e.id, { tipo_rotulo: e.tipo_rotulo, valor: e.valor, rank: e.rank }]));
  const quando = lote.gerado_em ? new Date(lote.gerado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : null;
  const modelos = [...new Set(lote.decisoes.filter((d) => !d.simulado).map((d) => d.modelo))];

  // Qualidade: a IA chega ao mesmo nível de tratamento que a política usada nos números?
  const porId = new Map(fila.map((e) => [e.id, e]));
  const comIA = lote.decisoes.filter((d) => !d.simulado);
  const mesmoNivel = comIA.filter((d) => porId.get(d.id)?.nivel === d.nivel).length;
  const corrigidas = comIA.filter((d) => (d.correcoes ?? 0) > 0).length;
  const divergentes = comIA.filter((d) => porId.get(d.id)?.nivel !== d.nivel);
  const ROT = { auto: "resolver sozinho", aprovacao: "aprovação", humano: "pessoa" } as const;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Ações do agente · Agente de Fila</div>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">O que o agente fez, e o que espera você</h1>
        <p className="mt-1 text-ink-2">Sem custo, ele executa. Com custo, você aprova. Fora da política, ele passa para uma pessoa.</p>
        <p className="mt-2 text-xs text-muted">
          {quando
            ? <>Lote de {quando}: {n(lote.decisoes.length)} casos {modelos.length ? "com IA" : "simulados"}. Execuções ao vivo também aparecem aqui.</>
            : <>Ainda sem lote: rode o agente num pedido da Fila do dia.</>}
        </p>
      </section>
      {comIA.length > 0 && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-ink-2" /> Qualidade do agente</h2>
          <p className="mt-1 text-sm text-ink-2">A IA, investigando sozinha, chega à mesma decisão da política usada nos números?</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line p-4">
              <div className="tabular text-2xl font-semibold">{Math.round((mesmoNivel / comIA.length) * 100)}%</div>
              <div className="mt-1 text-sm text-ink-2">dos {comIA.length} casos com IA no mesmo nível que a política ({mesmoNivel} de {comIA.length})</div>
            </div>
            <div className="rounded-lg border border-line p-4">
              {corrigidas > 0 ? (
                <>
                  <div className="tabular text-2xl font-semibold">{corrigidas}</div>
                  <div className="mt-1 text-sm text-ink-2">{corrigidas === 1 ? "caso em que a política barrou" : "casos em que a política barrou"} uma ação da IA, e ela se corrigiu</div>
                </>
              ) : (
                <>
                  <div className="tabular text-2xl font-semibold">{comIA.length} de {comIA.length}</div>
                  <div className="mt-1 text-sm text-ink-2">decisões aprovadas de primeira nas checagens de política e de dados inventados</div>
                </>
              )}
            </div>
            <div className="rounded-lg border border-line p-4">
              <div className="text-sm font-medium">Guardrails em código</div>
              <div className="mt-1 text-sm text-ink-2">limite de R$ 200, cliente VIP, ação compatível com o tipo, lote com defeito, falso atraso, mensagem sem dados inventados</div>
            </div>
          </div>
          {divergentes.length > 0 && (
            <details className="mt-3 text-xs leading-relaxed text-muted">
              <summary className="cursor-pointer">Ver as {divergentes.length} divergências</summary>
              Divergências: {divergentes.map((d) => `${d.pedido} (${porId.get(d.id)?.tipo_rotulo.toLowerCase()}: política ${ROT[porId.get(d.id)!.nivel]}, IA ${ROT[d.nivel]} — ${d.acao_rotulo.toLowerCase()})`).join("; ")}.
              {divergentes.every((d) => porId.get(d.id)?.tipo === "devolvido_transportadora") &&
                " Nas devoluções, a IA preferiu acionar a transportadora antes de reenviar, uma ação sem custo dentro da política."}
            </details>
          )}
        </section>
      )}
      <AcoesLista lote={lote.decisoes} extras={extras} />
    </div>
  );
}
