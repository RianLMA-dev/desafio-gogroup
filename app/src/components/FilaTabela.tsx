"use client";
import { useMemo, useState } from "react";
import { Search, Sparkles, Crown } from "lucide-react";
import type { LinhaFila } from "@/lib/data";
import { reais, NIVEL } from "@/lib/format";
import DetalhePainel from "./DetalhePainel";

const ABAS = [
  { id: "time", rotulo: "Para o time hoje" },
  { id: "agente", rotulo: "Resolvidos pelo agente" },
  { id: "todas", rotulo: "Fila completa" },
] as const;
type Aba = (typeof ABAS)[number]["id"];
const POR_PAGINA = 50;

export function ChipNivel({ nivel }: { nivel: LinhaFila["nivel"] }) {
  const cfg = NIVEL[nivel];
  return (
    <span className="chip border border-line bg-surface text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: cfg.cor }} />{cfg.curto}
    </span>
  );
}

export default function FilaTabela({ linhas, abrirInicial = null }: { linhas: LinhaFila[]; abrirInicial?: string | null }) {
  const [aba, setAba] = useState<Aba>("time");
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<string | null>(abrirInicial);

  const base = useMemo(() => ({
    time: linhas.filter((l) => l.dia_agente === 0 && l.nivel !== "auto"),
    agente: linhas.filter((l) => l.nivel === "auto"),
    todas: linhas,
  }), [linhas]);

  const tipos = useMemo(() => Array.from(new Map(linhas.map((l) => [l.tipo, l.tipo_rotulo]))).sort((a, b) => a[1].localeCompare(b[1])), [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return base[aba].filter((l) => (!tipo || l.tipo === tipo) && (!q || l.pedido.includes(q) || l.id.includes(q)));
  }, [base, aba, tipo, busca]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const mudar = (fn: () => void) => { fn(); setPagina(0); };

  return (
    <div className="card overflow-hidden">
      {/* Abas e filtros */}
      <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {ABAS.map((a) => (
            <button key={a.id} onClick={() => mudar(() => setAba(a.id))}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${aba === a.id ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2"}`}>
              {a.rotulo} <span className="tabular text-muted">{base[a.id].length.toLocaleString("pt-BR")}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={tipo} onChange={(e) => mudar(() => setTipo(e.target.value))}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink-2">
            <option value="">Todos os tipos</option>
            {tipos.map(([id, r]) => <option key={id} value={id}>{r}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-line px-2">
            <Search size={14} className="text-muted" />
            <input value={busca} onChange={(e) => mudar(() => setBusca(e.target.value))} placeholder="Pedido"
              className="w-28 bg-transparent py-1.5 text-sm outline-none" />
          </label>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">
              <th className="py-2 pl-4 font-normal">#</th>
              <th className="py-2 font-normal">Pedido</th>
              <th className="py-2 font-normal">Exceção</th>
              <th className="py-2 text-right font-normal">Valor</th>
              <th className="py-2 text-right font-normal" title="Quanto a perda esperada cresce se o caso esperar mais 5 dias úteis">Risco se esperar 1 semana</th>
              <th className="py-2 pl-6 font-normal">Quem trata</th>
              <th className="py-2 pr-4 font-normal">Ação</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.id} onClick={() => setAberto(l.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2">
                <td className="tabular py-2.5 pl-4 text-muted">{l.rank}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5 font-medium">{l.pedido}{l.vip && <Crown size={13} className="text-serious-ink" aria-label="Cliente VIP" />}</div>
                  <div className="text-xs text-muted">{l.marca} · {l.uf}</div>
                </td>
                <td className="py-2.5">
                  <div>{l.tipo_rotulo}</div>
                  {l.causas.length > 0 && <div className="text-xs text-accent-ink">ligado a problema de processo</div>}
                </td>
                <td className="tabular py-2.5 text-right">{reais(l.valor)}</td>
                <td className="tabular py-2.5 text-right font-medium">+{reais(l.score)}</td>
                <td className="py-2.5 pl-6"><ChipNivel nivel={l.nivel} /></td>
                <td className="max-w-[260px] py-2.5 pr-4 text-ink-2">
                  <span className="inline-flex items-start gap-1.5">
                    {l.nivel !== "humano" && <Sparkles size={13} className="mt-[3px] shrink-0 text-accent" aria-label="Decidido pelo agente" />}
                    {l.acao_texto}
                  </span>
                </td>
              </tr>
            ))}
            {visiveis.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted">Nenhuma exceção com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-2">
        <span className="tabular">{filtradas.length.toLocaleString("pt-BR")} exceções</span>
        <div className="flex items-center gap-2">
          <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} className="btn btn-ghost px-3 py-1 disabled:opacity-40">Anterior</button>
          <span className="tabular">{pagina + 1} / {paginas}</span>
          <button disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)} className="btn btn-ghost px-3 py-1 disabled:opacity-40">Próxima</button>
        </div>
      </div>

      {aberto && <DetalhePainel id={aberto} onFechar={() => setAberto(null)} />}
    </div>
  );
}
