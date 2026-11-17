import "server-only";
import { getExcecao, causas, type Excecao } from "@/lib/data";

/**
 * Ferramentas do Agente de Fila. Cada uma lê os dados reais da operação e devolve
 * um JSON enxuto (para gastar poucos tokens). O agente decide quais chamar.
 */

export const LIMITE_VALOR = 200;
export const LIMITE_VIP = 1500;
export const LIMITE_CONTATOS = 3;

/** Catálogo de ações que o agente pode registrar. nivel = quanto de gente precisa. */
export const ACOES: Record<string, { rotulo: string; nivel: "auto" | "aprovacao" | "humano"; tipos: string[] | "todos" }> = {
  fechar_duplicado: { rotulo: "Fechar exceção duplicada", nivel: "auto", tipos: "todos" },
  comunicar_encerrar: { rotulo: "Pedir desculpas e encerrar", nivel: "auto", tipos: ["atraso_entrega"] },
  corrigir_promessa: { rotulo: "Avisar cliente da data correta", nivel: "auto", tipos: ["atraso_entrega", "rastreio_parado"] },
  acionar_transportadora: { rotulo: "Abrir chamado na transportadora e avisar cliente", nivel: "auto", tipos: ["atraso_entrega", "rastreio_parado", "extravio"] },
  lembrete_pagamento: { rotulo: "Enviar lembrete com novo link de pagamento", nivel: "auto", tipos: ["pagamento_pendente"] },
  cancelar_pagamento: { rotulo: "Cancelar pedido não pago e liberar estoque", nivel: "auto", tipos: ["pagamento_pendente"] },
  confirmar_endereco: { rotulo: "Pedir endereço completo ao cliente", nivel: "auto", tipos: ["endereco_divergente"] },
  nova_producao: { rotulo: "Reproduzir personalização em outra impressora", nivel: "aprovacao", tipos: ["falha_personalizacao"] },
  reenvio_com_foto: { rotulo: "Pedir foto e reenviar sem custo", nivel: "aprovacao", tipos: ["avaria_transporte", "vazamento_produto", "item_faltante"] },
  reenvio_outro_lote: { rotulo: "Reenviar de outro lote (lote com defeito)", nivel: "aprovacao", tipos: ["vazamento_produto"] },
  reenvio_endereco: { rotulo: "Confirmar endereço e reenviar", nivel: "aprovacao", tipos: ["devolvido_transportadora", "endereco_divergente"] },
  decidir_reenvio_reembolso: { rotulo: "Pessoa decide reenvio ou reembolso", nivel: "humano", tipos: ["extravio"] },
  oferecer_troca_reembolso: { rotulo: "Pessoa oferece troca ou reembolso", nivel: "humano", tipos: ["ruptura_pos_venda"] },
  escalar_humano: { rotulo: "Encaminhar para uma pessoa", nivel: "humano", tipos: "todos" },
};

const r = (v: number) => Math.round(v * 100) / 100;

export function foraDaPolitica(e: Excecao): string | null {
  if (e.duplicado || (e.tipo === "atraso_entrega" && e.data_entrega)) return null;
  if (e.tipo === "extravio" || e.tipo === "ruptura_pos_venda") return "extravio e ruptura exigem decisão de reembolso/troca por uma pessoa";
  if (e.valor > LIMITE_VALOR) return `pedido de R$ ${e.valor.toFixed(2)} acima do limite de R$ ${LIMITE_VALOR}`;
  if (e.vip) return `cliente VIP (receita acumulada R$ ${e.cli_receita.toFixed(2)})`;
  if (e.cli_contatos >= LIMITE_CONTATOS) return `cliente já procurou o atendimento ${e.cli_contatos} vezes`;
  return null;
}

export function consultarPedido(e: Excecao) {
  return {
    pedido: e.pedido, marca: e.marca, produto: e.produto, valor: e.valor, itens: e.itens, brinde: e.brinde,
    tipo_excecao: e.tipo, status: e.status, transportadora: e.transportadora, destino: `${e.cidade}/${e.uf}`,
    cd: e.cd, turno: e.turno, impressora: e.maquina, lote: e.lote, sku: e.sku,
    duplicado: e.duplicado, aberta_ha_dias_uteis: e.dias_aberta,
  };
}

export function consultarCliente(e: Excecao) {
  const p = e.vip ? 0.7 : 0.28;
  return {
    cliente: e.cliente, pedidos: e.cli_pedidos, receita_acumulada: e.cli_receita, vip: e.vip,
    contatos_atendimento_12m: e.cli_contatos, chance_recompra_12m: p,
    alerta: e.cli_contatos >= LIMITE_CONTATOS ? "cliente já reclamou várias vezes" : null,
  };
}

export function verificarPrazo(e: Excecao) {
  return {
    data_pedido: e.data_pedido, data_prometida_ao_cliente: e.data_prometida, prazo_correto_dias_uteis: e.prazo_correto,
    entregue_em: e.data_entrega, sla_transportadora_dias_uteis: e.sla,
    atraso_percebido_pelo_cliente_dias_uteis: Math.max(0, e.atraso_prometido),
    atraso_real_dias_uteis: Math.max(0, e.atraso_real),
    falso_atraso: e.falso_atraso,
    hoje: "2026-09-30",
    ja_entregue: Boolean(e.data_entrega),
    prazo_correto_ja_passou: !e.data_entrega && e.prazo_correto < "2026-09-30",
    observacao: e.falso_atraso
      ? "A data prometida foi calculada errado (dias corridos). Pelo prazo correto o pedido ainda NÃO está atrasado."
      : null,
  };
}

/** Instruções que o Agente de Processo deixa para o Agente de Fila em cada problema conhecido. */
const INSTRUCOES: Record<string, string> = {
  promessa: "Bug na data prometida: informe ao cliente a data correta (prazo_correto) e peça desculpas pela informação errada.",
  rota_ne: "Rota Express com atraso no Nordeste: abra chamado com a Rota Express citando o pedido e avise o cliente com nova previsão.",
  carga_norte: "Carga Norte danificando frágeis: reenvie com embalagem reforçada e, se possível, por outra transportadora.",
  imp02: "Esta peça foi feita na impressora IMP-02, que está com defeito. A nova produção deve ser feita na IMP-01 ou IMP-03 — nunca na IMP-02. Isso é só para a nota_interna: ao cliente, diga apenas que vamos produzir uma nova peça, sem citar impressora.",
  cd2_noite: "Erro de separação de kits com brinde no CD2 noite: o reenvio deve passar por conferência (bipagem) antes de sair.",
  lote: "O produto deste pedido é do lote L2607-B, que tem defeito de vazamento. Use a ação reenvio_outro_lote e reenvie de QUALQUER lote, EXCETO o L2607-B. Isso é só para a nota_interna: ao cliente, diga apenas que vamos enviar um produto novo, sem citar lote ou defeito de fabricação.",
  kokeshi: "SKU vendido sem estoque: confira a previsão de reposição antes de oferecer troca.",
  duplicados: "Exceção duplicada: feche esta, a original segue em tratamento.",
};

export function verificarIncidentes(e: Excecao) {
  const lig = causas.filter((c) => e.causas.includes(c.id));
  return {
    incidentes: lig.map((c) => ({ id: c.id, problema: c.titulo, instrucao: INSTRUCOES[c.id] ?? null })),
    nenhum: lig.length === 0 ? "Caso isolado: não faz parte de nenhum problema de processo conhecido." : null,
  };
}

export function consultarPolitica(e: Excecao) {
  // formato compacto "acao (nivel): descrição" — economiza tokens
  const permitidas = Object.entries(ACOES)
    .filter(([id, a]) => (a.tipos === "todos" || a.tipos.includes(e.tipo)) && (id !== "fechar_duplicado" || e.duplicado))
    .map(([id, a]) => `${id} (${a.nivel}): ${a.rotulo}`);
  const fora = foraDaPolitica(e);
  return {
    acoes_permitidas: permitidas,
    agente_pode_agir_sozinho: !fora,
    motivo: fora ?? "dentro da política (até R$ 200, não VIP, < 3 contatos)",
    regras: "auto = agente executa (sem custo). aprovacao = pessoa aprova o custo em 1 clique. Fora da política: só ações humano, com recomendação na nota_interna. Reenvio por avaria/vazamento/faltante é sem custo ao cliente, mediante foto.",
    custo_reenvio_estimado: r(e.valor * 0.24 + e.frete),
  };
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

/** Resumo legível do que cada ferramenta encontrou (mostrado na tela, abaixo do passo). */
export function achado(nome: string, e: Excecao): { texto: string; instrucao?: string } {
  switch (nome) {
    case "consultar_pedido":
      return { texto: `${e.produto} · ${brl(e.valor)}${e.itens > 1 ? ` · ${e.itens} itens` : ""}${e.brinde ? " + brinde" : ""} · ${e.transportadora} para ${e.cidade}/${e.uf}${e.duplicado ? " · exceção DUPLICADA" : ""}` };
    case "consultar_cliente":
      return { texto: `${e.vip ? "Cliente VIP · " : ""}${e.cli_pedidos} ${e.cli_pedidos === 1 ? "pedido" : "pedidos"} · ${brl(e.cli_receita)} em compras · ${e.cli_contatos} ${e.cli_contatos === 1 ? "contato" : "contatos"} no atendimento` };
    case "verificar_prazo": {
      if (e.falso_atraso) return { texto: `Prometido ${dm(e.data_prometida)}, mas o prazo correto é ${dm(e.prazo_correto)}: não está atrasado de verdade` };
      if (e.data_entrega) return { texto: `Entregue em ${dm(e.data_entrega)} · prometido para ${dm(e.data_prometida)}` };
      if (e.atraso_prometido > 0) return { texto: `${Math.max(0, e.atraso_real)} dias úteis de atraso real · cliente percebe ${e.atraso_prometido} · SLA ${e.sla} dias` };
      return { texto: `Dentro do prazo · prometido para ${dm(e.data_prometida)}` };
    }
    case "verificar_incidentes": {
      const ligadas = causas.filter((c) => e.causas.includes(c.id));
      if (!ligadas.length) return { texto: "Caso isolado: nenhum problema de processo conhecido" };
      return { texto: `Faz parte de: ${ligadas.map((c) => c.titulo).join(" · ")}`, instrucao: ligadas.map((c) => INSTRUCOES[c.id]).filter(Boolean).join(" ") };
    }
    case "consultar_politica": {
      const fora = foraDaPolitica(e);
      return { texto: fora ? `Fora da política do agente: ${fora}` : "Dentro da política: o agente pode agir" };
    }
  }
  return { texto: "" };
}

export const FERRAMENTAS: Record<string, { rotulo: string; fn: (e: Excecao) => unknown }> = {
  consultar_pedido: { rotulo: "Consultando o pedido", fn: consultarPedido },
  consultar_cliente: { rotulo: "Consultando histórico do cliente", fn: consultarCliente },
  verificar_prazo: { rotulo: "Verificando prazo e transportadora", fn: verificarPrazo },
  verificar_incidentes: { rotulo: "Checando problemas de processo conhecidos", fn: verificarIncidentes },
  consultar_politica: { rotulo: "Consultando a política de tratativas", fn: consultarPolitica },
};

/** Definição das ferramentas no formato OpenAI/Groq. */
export const TOOLS_SCHEMA = [
  ...Object.keys(FERRAMENTAS).map((nome) => ({
    type: "function" as const,
    function: {
      name: nome,
      description: {
        consultar_pedido: "Dados do pedido e da exceção (produto, valor, transportadora, CD, turno, impressora, lote).",
        consultar_cliente: "Histórico do cliente: pedidos, receita, VIP, contatos no atendimento.",
        verificar_prazo: "Data prometida, prazo correto em dias úteis, atraso percebido e real.",
        verificar_incidentes: "Se o caso faz parte de um problema de processo conhecido e o que fazer nesse caso.",
        consultar_politica: "Ações permitidas para este caso e se o agente pode agir sozinho.",
      }[nome],
      parameters: { type: "object", properties: {}, required: [] },
    },
  })),
  {
    type: "function" as const,
    function: {
      name: "registrar_acao",
      description: "Registra a decisão final. Chame uma única vez, no fim, depois de investigar.",
      parameters: {
        type: "object",
        properties: {
          acao: { type: "string", enum: Object.keys(ACOES), description: "Ação escolhida (precisa estar nas permitidas)." },
          justificativa: { type: "string", description: "1 a 2 frases: por que esta ação, citando os fatos do caso." },
          mensagem_cliente: { type: "string", description: "Mensagem ao cliente (WhatsApp), em português, assinada 'Equipe {marca}'. Obrigatória em todas as ações, exceto fechar_duplicado. Em ações de nivel humano, é o rascunho que a pessoa vai revisar e enviar." },
          mensagem_transportadora: { type: "string", description: "Texto do chamado para a transportadora, se a ação envolver transportadora. Senão vazio." },
          nota_interna: { type: "string", description: "Nota curta para o time (o que a pessoa precisa fazer ou conferir)." },
        },
        required: ["acao", "justificativa", "mensagem_cliente", "nota_interna"],
      },
    },
  },
];

export function validarAcao(e: Excecao, acao: string, mensagem = ""): string | null {
  const a = ACOES[acao];
  if (!a) return `Ação "${acao}" não existe.`;
  if (a.tipos !== "todos" && !a.tipos.includes(e.tipo)) return `Ação "${acao}" não se aplica a ${e.tipo}. Consulte a política.`;
  if (acao === "fechar_duplicado" && !e.duplicado) return "Este caso não é duplicado.";
  if (acao === "corrigir_promessa" && !e.falso_atraso) return "corrigir_promessa só vale para falso atraso; este pedido está atrasado de verdade (veja verificar_prazo).";
  // nada de problema interno na mensagem ao cliente (máquina, lote, CD, turno, incidente)
  const interno = mensagem.match(/impressora|IMP-0\d|\blotes?\b|L26\d\d|\bCD ?[12]\b|\bturno\b|incidente/i);
  if (interno) return `A mensagem ao cliente cita um detalhe interno ("${interno[0]}"). Explique o que vamos fazer por ele, sem citar máquina, lote, CD, turno ou incidente.`;
  if (acao !== "fechar_duplicado" && mensagem.trim() && !mensagem.includes(`Equipe ${e.marca}`)) return `Assine a mensagem ao cliente como "Equipe ${e.marca}".`;
  const marcadores = (mensagem.match(/\[[^\]]*\]/g) ?? []).filter((m) => m !== "[link de pagamento]");
  if (marcadores.length) return `A mensagem tem campos a preencher (${marcadores.join(", ")}). Não temos esses dados: reescreva sem eles (ex.: peça ao cliente a informação).`;
  if (acao === "reenvio_com_foto" && e.causas.includes("lote")) return "Este produto é do lote L2607-B com defeito: use reenvio_outro_lote.";
  const fora = foraDaPolitica(e);
  if (fora && a.nivel !== "humano") return `Fora da política (${fora}). Escolha uma ação de nivel humano e deixe a recomendação na nota_interna.`;
  return null;
}

export function getCaso(id: string) {
  return getExcecao(id);
}
