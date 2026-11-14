const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("pt-BR");

export const reais = (v: number) => brl0.format(v);
export const reaisC = (v: number) => brl2.format(v);
export const n = (v: number) => num.format(v);
export const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace(".", ",")}%`;

/** R$ 32,7 mil */
export const mil = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil` : reais(v);

export const data = (iso: string | null) => {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export const NIVEL = {
  auto: { rotulo: "Agente resolve", curto: "Agente", cor: "var(--good)" },
  aprovacao: { rotulo: "Aprovar em 1 clique", curto: "Aprovação", cor: "var(--accent)" },
  humano: { rotulo: "Precisa de pessoa", curto: "Pessoa", cor: "var(--serious)" },
} as const;
