import "server-only";
import filaJson from "@/data/fila.json";
import resumoJson from "@/data/resumo.json";
import causasJson from "@/data/causas.json";

export type Nivel = "auto" | "aprovacao" | "humano";

export interface Excecao {
  id: string; rank: number; pedido: string; cliente: string; marca: string; produto: string; sku: string;
  itens: number; brinde: boolean; valor: number; tipo: string; tipo_rotulo: string; status: string;
  transportadora: string; uf: string; cidade: string; cd: string; turno: string; maquina: string | null; lote: string;
  data_pedido: string; data_prometida: string; prazo_correto: string; data_entrega: string | null; data_abertura: string;
  atraso_prometido: number; atraso_real: number; falso_atraso: boolean; dias_aberta: number; duplicado: boolean;
  cli_pedidos: number; cli_receita: number; cli_contatos: number; vip: boolean; sla: number; frete: number;
  perda_hoje: number; perda_5d: number; score: number;
  comp: { cancelamento: number; resolucao: number; recompra: number; contatos: number; venda: number };
  acao: string; acao_texto: string; nivel: Nivel; motivo_nivel: string; causas: string[];
  dia_fifo: number; dia_prioridade: number; dia_agente: number;
}

export interface Causa {
  id: string; titulo: string; categoria: string; responsavel: string; resumo: string;
  evidencia: string[]; causa_provavel: string; acoes: string[];
  grafico: null | { tipo: "barras" | "linha"; titulo: string; dados: { grupo?: string; semana?: string; casos: number; total?: number; taxa?: number }[] };
  n_casos: number; casos_evitaveis: number; custo_periodo: number; custo_mensal: number; horas_time_mes: number;
  pedidos: string[]; monitorar: boolean;
}

export type Resumo = typeof resumoJson;

export const fila = filaJson as Excecao[];
export const resumo = resumoJson as Resumo;
export const causas = causasJson as Causa[];

const porId = new Map(fila.map((e) => [e.id, e]));
export const getExcecao = (id: string) => porId.get(id);

/** Campos enxutos para a tabela (o detalhe vem da API). */
export type LinhaFila = Pick<Excecao,
  "id" | "rank" | "pedido" | "marca" | "tipo" | "tipo_rotulo" | "valor" | "score" | "perda_hoje" | "nivel" |
  "acao_texto" | "causas" | "dia_agente" | "vip" | "uf" | "transportadora" | "dias_aberta" | "atraso_prometido">;

export const linhaFila = (e: Excecao): LinhaFila => ({
  id: e.id, rank: e.rank, pedido: e.pedido, marca: e.marca, tipo: e.tipo, tipo_rotulo: e.tipo_rotulo, valor: e.valor,
  score: e.score, perda_hoje: e.perda_hoje, nivel: e.nivel, acao_texto: e.acao_texto, causas: e.causas,
  dia_agente: e.dia_agente, vip: e.vip, uf: e.uf, transportadora: e.transportadora, dias_aberta: e.dias_aberta,
  atraso_prometido: e.atraso_prometido,
});

export const tituloCausa = Object.fromEntries(causas.map((c) => [c.id, c.titulo]));

import loteJson from "@/data/lote_agente.json";
import relatoriosJson from "@/data/relatorios.json";
import type { Decisao, Relatorio } from "@/lib/agente/tipos";

export const lote = loteJson as { gerado_em: string | null; modo: "ia" | "simulado" | null; decisoes: (Decisao & { correcoes?: number })[] };
export const relatorios = relatoriosJson as Record<string, Relatorio>;

import robustezJson from "@/data/robustez.json";
export const robustez = robustezJson as {
  id: string; rotulo: string; economia_agente: number; economia_prioridade: number; pct_recuperado: number | null;
  dias_agente: number; dias_fifo: number;
}[];
