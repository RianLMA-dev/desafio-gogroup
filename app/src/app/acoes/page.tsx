import { lote, fila, resumo } from "@/lib/data";
import AcoesLista from "@/components/AcoesLista";
import { n } from "@/lib/format";

export default function AcoesPage() {
  // dados de todas as exceções, para também mostrar execuções ao vivo de qualquer caso
  const extras = Object.fromEntries(fila.map((e) => [e.id, { tipo_rotulo: e.tipo_rotulo, valor: e.valor, rank: e.rank }]));
  const quando = lote.gerado_em ? new Date(lote.gerado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  const modelos = [...new Set(lote.decisoes.filter((d) => !d.simulado).map((d) => d.modelo))];
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Ações do agente · Agente de Fila</div>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">O que o agente fez, e o que espera você</h1>
        <p className="mt-2 max-w-3xl text-ink-2">
          Ações sem custo (avisar cliente, abrir chamado, fechar duplicado) o agente executa sozinho. Ações que geram custo, como reenvio
          e nova produção, ele deixa prontas para uma pessoa aprovar em 1 clique. Fora da política, ele encaminha com a recomendação e o rascunho da mensagem.
        </p>
        <p className="mt-3 text-xs text-muted">
          {quando
            ? <>Processamento em lote de {quando}: os {n(lote.decisoes.length)} casos mais urgentes do dia, divididos entre os três níveis
              {modelos.length ? <> ({modelos.join(", ")} via Groq)</> : <> (modo simulado, sem IA)</>}. Na fila completa são {n(resumo.niveis.auto)} casos executados
              e {n(resumo.niveis.aprovacao)} aprovações, pela mesma política. Execuções feitas com “Rodar agente agora” também aparecem aqui.</>
            : <>Ainda não há processamento em lote. Rode o agente em um pedido da Fila do dia ou execute <code>npm run agente:lote</code>.</>}
        </p>
      </section>
      <AcoesLista lote={lote.decisoes} extras={extras} />
    </div>
  );
}
