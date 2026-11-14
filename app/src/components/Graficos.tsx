"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const brl = (v: number) => `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil`;
const eixo = { fontSize: 12, fill: "var(--muted)" };

/** Rótulo à direita da barra, sem quebra de linha. */
const rotulo = (fmt: (v: number) => string, size = 12, peso = 400, cor = "var(--ink-2)") =>
  function Rotulo(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string }) {
    const x = Number(p.x ?? 0) + Number(p.width ?? 0) + 6;
    const y = Number(p.y ?? 0) + Number(p.height ?? 0) / 2;
    return <text x={x} y={y} dominantBaseline="middle" fontSize={size} fontWeight={peso} fill={cor} style={{ whiteSpace: "nowrap" }}>{fmt(Number(p.value))}</text>;
  };

export const CENARIOS = [
  { id: "fifo", nome: "Ordem de chegada (hoje)", cor: "var(--s1)" },
  { id: "prioridade", nome: "Priorização por valor", cor: "var(--s2)" },
  { id: "agente", nome: "Priorização + agente", cor: "var(--s3)" },
] as const;

function Dica({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload: Record<string, unknown> }[]; label?: string | number; fmt: (v: number) => string; }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      {label !== undefined && <div className="mb-1 font-medium text-ink">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular font-medium text-ink">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Perda evitável por cenário — barras horizontais. */
export function BarrasCenarios({ dados }: { dados: { id: string; evitavel: number }[] }) {
  const linhas = CENARIOS.map((c) => ({ ...c, valor: dados.find((d) => d.id === c.id)?.evitavel ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={linhas} layout="vertical" margin={{ left: 0, right: 96, top: 4, bottom: 4 }} barCategoryGap={10}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="nome" width={180} tick={{ ...eixo, fill: "var(--ink-2)" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) =>
          active && payload?.length ? (
            <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
              <div className="font-medium">{payload[0].payload.nome}</div>
              <div className="text-ink-2">Perda evitável: <b className="tabular text-ink">{brl(payload[0].payload.valor)}</b></div>
            </div>) : null} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {linhas.map((l) => <Cell key={l.id} fill={l.cor} />)}
          <LabelList dataKey="valor" content={rotulo(brl, 13, 600, "var(--ink)")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Exceções ainda na fila por dia útil, nos 3 cenários. */
export function LinhaFilaRestante({ curvas }: { curvas: Record<string, number>[] }) {
  const dados = curvas.map((c) => ({ dia: c.dia, fifo: c.restante_fifo, prioridade: c.restante_prioridade, agente: c.restante_agente }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={dados} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="dia" tick={eixo} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false}
          tickFormatter={(d) => (d === 0 ? "hoje" : `d${d}`)} />
        <YAxis tick={eixo} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => v.toLocaleString("pt-BR")} />
        <Tooltip content={<Dica fmt={(v) => `${v.toLocaleString("pt-BR")} na fila`} />} labelFormatter={(d) => (d === 0 ? "Hoje" : `Dia útil ${d}`)} />
        {CENARIOS.map((c) => (
          <Line key={c.id} type="stepAfter" dataKey={c.id} name={c.nome} stroke={c.cor} strokeWidth={c.id === "fifo" ? 3 : 2} dot={false}
            strokeDasharray={c.id === "prioridade" ? "6 4" : undefined}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Legenda() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
      {CENARIOS.map((c) => (
        <span key={c.id} className="flex items-center gap-2">
          <span className="w-4" style={{ borderTop: `${c.id === "fifo" ? 3 : 2}px ${c.id === "prioridade" ? "dashed" : "solid"} ${c.cor}` }} />{c.nome}
        </span>
      ))}
    </div>
  );
}

/** Gráfico de evidência de uma causa-raiz (série única). */
export function GraficoCausa({ g }: { g: { tipo: "barras" | "linha"; dados: { grupo?: string; semana?: string; casos: number; total?: number; taxa?: number }[] } }) {
  const usarTaxa = g.dados.some((d) => d.taxa !== undefined);
  const dados = g.dados.map((d) => ({
    rotulo: d.semana ? `${d.semana.slice(8, 10)}/${d.semana.slice(5, 7)}` : d.grupo,
    valor: usarTaxa ? Math.round((d.taxa ?? 0) * 100) : d.casos,
    casos: d.casos, total: d.total,
  }));
  const fmt = (v: number) => (usarTaxa ? `${v}%` : `${v} casos`);
  if (g.tipo === "linha") {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={dados} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="rotulo" tick={eixo} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} />
          <YAxis tick={eixo} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<Dica fmt={fmt} />} labelFormatter={(l) => `Semana de ${l}`} />
          <Line dataKey="valor" name="Casos" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  const max = Math.max(...dados.map((d) => d.valor));
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, dados.length * 30 + 10)}>
      <BarChart data={dados} layout="vertical" margin={{ left: 0, right: 72, top: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="rotulo" width={110} tick={{ ...eixo, fill: "var(--ink-2)" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={({ active, payload }) =>
          active && payload?.length ? (
            <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
              <div className="font-medium">{payload[0].payload.rotulo}</div>
              <div className="text-ink-2">{usarTaxa ? `${payload[0].payload.casos} de ${payload[0].payload.total} exceções (${payload[0].payload.valor}%)` : `${payload[0].payload.casos} casos`}</div>
            </div>) : null} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {dados.map((d) => <Cell key={d.rotulo} fill={d.valor === max ? "var(--accent)" : "var(--line-strong)"} />)}
          <LabelList dataKey="valor" content={rotulo(fmt)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
