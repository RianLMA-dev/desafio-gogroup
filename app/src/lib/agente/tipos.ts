/** Tipos compartilhados entre servidor e navegador (sem "server-only"). */
export interface Decisao {
  id: string; pedido: string; marca: string; cliente: string;
  acao: string; acao_rotulo: string; nivel: "auto" | "aprovacao" | "humano";
  justificativa: string; mensagem_cliente: string; mensagem_transportadora: string; nota_interna: string;
  transportadora: string; passos: string[]; modelo: string; simulado: boolean; gerado_em: string;
}

export type Evento =
  | { tipo: "inicio"; id: string; pedido: string; modo: "ia" | "simulado" }
  | { tipo: "ferramenta"; nome: string; rotulo: string; resultado: unknown }
  | { tipo: "correcao"; texto: string }
  | { tipo: "acao"; resultado: Decisao }
  | { tipo: "erro"; texto: string };

export interface Relatorio {
  causa: string; titulo: string; severidade: "crítica" | "alta" | "média" | "baixa";
  resumo_executivo: string; o_que_acontece: string; evidencias: string[]; causa_raiz: string;
  impacto: string; acoes: { acao: string; responsavel: string; prazo: string }[];
  pedidos_afetados: string; como_medir: string;
  modelo: string; simulado: boolean; gerado_em: string;
}
