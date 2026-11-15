import { ShoppingCart, PackageCheck, Printer, Boxes, Truck, ClipboardList, ChevronRight, ChevronDown } from "lucide-react";
import type { Causa } from "@/lib/data";
import { mil } from "@/lib/format";

/** Caminho do pedido, da compra à tratativa, com cada causa-raiz no ponto em que acontece. */
const ETAPAS = [
  { id: "site", titulo: "Site e checkout", icone: ShoppingCart, causas: ["promessa", "kokeshi"] },
  { id: "produto", titulo: "Produto e fornecedor", icone: PackageCheck, causas: ["lote"] },
  { id: "producao", titulo: "Produção", icone: Printer, causas: ["imp02"] },
  { id: "separacao", titulo: "Separação no CD", icone: Boxes, causas: ["cd2_noite"] },
  { id: "transporte", titulo: "Transporte", icone: Truck, causas: ["rota_ne", "carga_norte"] },
  { id: "tratativa", titulo: "Tratativa", icone: ClipboardList, causas: ["duplicados", "fila_velha"] },
];

const CURTO: Record<string, string> = {
  promessa: "Prazo prometido errado",
  kokeshi: "Venda sem estoque (Kokeshi)",
  lote: "Lote L2607-B com vazamento",
  imp02: "Impressora IMP-02",
  cd2_noite: "Kits com brinde, CD2 noite",
  rota_ne: "Rota Express no Nordeste",
  carga_norte: "Carga Norte quebra frágeis",
  duplicados: "Exceções duplicadas",
  fila_velha: "Fila por ordem de chegada",
};

export default function MapaCausas({ causas }: { causas: Causa[] }) {
  const porId = new Map(causas.map((c) => [c.id, c]));
  const totais = ETAPAS.map((e) => e.causas.reduce((s, id) => s + (porId.get(id)?.custo_mensal ?? 0), 0));
  const maior = Math.max(...totais);

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Onde os problemas nascem</h2>
      <p className="mt-1 text-sm text-ink-2">O caminho de um pedido, da compra até a tratativa da exceção. Cada causa aparece na etapa em que acontece; clique para ver a evidência.</p>
      <div className="mt-5 flex flex-col items-stretch gap-1 lg:flex-row lg:items-stretch lg:gap-0">
        {ETAPAS.map((etapa, i) => {
          const Icone = etapa.icone;
          const total = totais[i];
          const intensidade = maior ? total / maior : 0;
          return (
            <div key={etapa.id} className="flex flex-col items-stretch lg:flex-1 lg:flex-row">
              <div className="flex flex-1 flex-col rounded-xl border p-3"
                style={{ borderColor: total ? "color-mix(in srgb, var(--accent) 35%, var(--line))" : "var(--line)",
                         background: `color-mix(in srgb, var(--accent-soft) ${Math.round(25 + intensidade * 75)}%, var(--surface))` }}>
                <div className="flex items-center gap-2 text-sm font-medium"><Icone size={16} className="text-accent-ink" />{etapa.titulo}</div>
                <div className="tabular mt-1 text-xs text-ink-2">{total ? `${mil(total)}/mês` : "custo em horas do time"}</div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {etapa.causas.map((id) => {
                    const c = porId.get(id);
                    if (!c) return null;
                    return (
                      <li key={id}>
                        <a href={`#${id}`} className="block rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] leading-snug transition-colors hover:border-accent">
                          {CURTO[id] ?? c.titulo}
                          <span className="tabular mt-0.5 block text-[11px] text-muted">
                            {c.custo_mensal > 0 ? `${mil(c.custo_mensal)}/mês` : c.horas_time_mes > 0 ? `${Math.round(c.horas_time_mes)} h/mês` : `${c.n_casos} exceções`}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {i < ETAPAS.length - 1 && (
                <div className="flex items-center justify-center py-0.5 text-muted lg:px-1 lg:py-0" aria-hidden>
                  <ChevronDown size={16} className="lg:hidden" /><ChevronRight size={16} className="hidden lg:block" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
