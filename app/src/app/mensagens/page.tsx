import { lote, fila } from "@/lib/data";
import MensagensView from "@/components/MensagensView";

export default function MensagensPage() {
  const extras = Object.fromEntries(fila.map((e) => [e.id, { tipo_rotulo: e.tipo_rotulo, rank: e.rank }]));
  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Mensagens · simulação</div>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">O que o agente escreveu para clientes e transportadoras</h1>
        <p className="mt-1 text-ink-2">Enviadas ou em rascunho até alguém aprovar. Em produção, sairiam pelo WhatsApp e pelos portais das transportadoras.</p>
      </section>
      <MensagensView lote={lote.decisoes} extras={extras} />
    </div>
  );
}
