import { lote, fila } from "@/lib/data";
import MensagensView from "@/components/MensagensView";

export default function MensagensPage() {
  const extras = Object.fromEntries(fila.map((e) => [e.id, { tipo_rotulo: e.tipo_rotulo, rank: e.rank }]));
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Mensagens · simulação</div>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">O que o agente escreveu para clientes e transportadoras</h1>
        <p className="mt-2 max-w-3xl text-ink-2">
          Mensagens de ações executadas aparecem como enviadas. As que dependem de aprovação ficam como rascunho até alguém aprovar
          em Ações do agente. Em produção, sairiam pela API do WhatsApp e pelos portais das transportadoras.
        </p>
      </section>
      <MensagensView lote={lote.decisoes} extras={extras} />
    </div>
  );
}
