"""
Motor de cálculo — fila de exceções (Gogroup, Problema 2: Operações)

Calcula, para cada exceção:
  - atraso real (dias úteis) contra a promessa feita ao cliente e contra o prazo correto
  - perda esperada se a exceção for resolvida no dia d (curva que cresce com a espera)
  - score de prioridade = quanto a perda cresce se o pedido esperar mais 5 dias úteis
  - se o Agente de Fila pode resolver sozinho ou se precisa de uma pessoa

E simula 3 cenários com a capacidade do time (150 tratativas/dia útil):
  1. Ordem de chegada (como é hoje)
  2. Priorização por valor em risco (só time humano)
  3. Priorização + Agente de Fila resolvendo a parte automatizável

Uso:  python analise/motor.py   → gera app/src/data/*.json
"""
import json, os
import numpy as np
import pandas as pd

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, "dados")
SAIDA = os.path.join(RAIZ, "app", "src", "data")

# ---------------------------------------------------------------------------
# PARÂMETROS DO NEGÓCIO (parametros.md)
# ---------------------------------------------------------------------------
HOJE = np.datetime64("2026-09-30")
FERIADOS = ["2026-09-07", "2026-10-12"]
CAPACIDADE_DIA = 150
CMV = 0.24                      # custo da mercadoria, % do valor do pedido
CUSTO_CONTATO = 9.00
LIMIAR_VIP = 1500               # receita acumulada
P_RECOMPRA_VIP, P_RECOMPRA_DEMAIS = 0.70, 0.28
FATOR_MAL_RESOLVIDA = 0.5       # recompra cai pela metade

# Botões das premissas mais incertas (usados na análise de robustez — analise/robustez.py)
MAL_INICIO, MAL_RAMPA = 2, 8    # "mal resolvida": 0% até 2 dias úteis de espera, 100% com 2+8 = 10
MULT_CANCEL = 1.0               # multiplicador da tabela de cancelamento
MULT_RECOMPRA = 1.0             # multiplicador do valor de recompra
CONTATO_A_CADA = 10             # cliente procura o atendimento 1x a cada N dias úteis de espera


def p_cancelamento(dias_uteis_atraso):
    """Tabela de cancelamento por dias úteis de atraso (parametros.md)."""
    d = np.asarray(dias_uteis_atraso)
    return np.minimum(1.0, MULT_CANCEL * np.select([d <= 0, d <= 2, d <= 5, d <= 10], [0.0, 0.04, 0.10, 0.22], 0.40))


# ---------------------------------------------------------------------------
# PREMISSAS (não estão nos parâmetros — explícitas no app e no README)
# ---------------------------------------------------------------------------
PREMISSAS = [
    {"id": "dias_uteis", "texto": "O time trabalha em dias úteis (seg–sex, sem feriados) e trata 150 exceções por dia útil, como diz parametros.md."},
    {"id": "congela", "texto": "Quando uma exceção é tratada (cliente recebe solução ou nova data), o risco para de crescer: a chance de cancelamento e o dano à recompra ficam no nível do dia do tratamento."},
    {"id": "atraso_cliente", "texto": "O cliente cancela com base na data que foi prometida a ele (data_prometida), mesmo que essa data esteja errada. Por isso o bug da promessa gera cancelamentos reais."},
    {"id": "pos_entrega", "texto": "Em problemas depois da entrega (avaria, vazamento, item faltante) e em problemas sem data de entrega (ruptura, falha de personalização, devolução, endereço), a tabela de cancelamento é aplicada aos dias úteis de espera desde a abertura da exceção."},
    {"id": "reembolso", "texto": "Se o cliente cancela, a empresa devolve o valor pago (custo de reembolso = valor do pedido) e não paga o reenvio."},
    {"id": "reenvio_item", "texto": "Item faltante reenvia só o item: CMV proporcional (valor × 24% ÷ nº de itens) + frete da transportadora."},
    {"id": "devolvido", "texto": "Pedido devolvido pela transportadora: o produto volta ao CD, então o custo de reenvio é só um novo frete."},
    {"id": "mal_resolvida", "texto": "Uma exceção é considerada mal resolvida de forma gradual: 0% se tratada em até 2 dias úteis de espera, subindo linearmente até 100% com 10 dias úteis."},
    {"id": "recompra", "texto": "O valor de uma recompra é o ticket médio do cliente (receita acumulada ÷ nº de pedidos) × margem bruta de 76% (100% − CMV). Consideramos uma recompra em 12 meses."},
    {"id": "contatos", "texto": "Enquanto espera sem solução, o cliente procura o atendimento 1 vez a cada 10 dias úteis, no máximo 3 vezes (R$ 9,00 por contato)."},
    {"id": "pagamento", "texto": "Pagamento pendente: chance de recuperar a venda com um lembrete cai com a idade do pedido — 50% até 3 dias, 25% até 7, 10% até 15 e 3% depois disso. A perda é a margem da venda não recuperada."},
    {"id": "atraso_entregue", "texto": "Atraso já entregue: não há mais risco de cancelamento. Resta só comunicar o cliente e encerrar."},
    {"id": "duplicados", "texto": "Exceções com o mesmo pedido e o mesmo tipo registradas duas vezes são duplicadas: a segunda é fechada sem custo."},
    {"id": "agente_regras", "texto": "O Agente de Fila só resolve sozinho pedidos até R$ 200 (cerca de 2× o ticket médio de R$ 110; testamos de R$ 100 a sem limite e acima de R$ 200 o ganho é mínimo), de clientes que não são VIP (receita < R$ 1.500) e com menos de 3 contatos no atendimento. Extravio e ruptura sempre vão para uma pessoa (decisão de reembolso/troca)."},
    {"id": "agente_niveis", "texto": "O agente trabalha em 3 níveis: (1) resolve sozinho ações só de comunicação ou sistema (fechar duplicado, avisar cliente, abrir chamado na transportadora, lembrete ou cancelamento de pagamento, pedir confirmação de endereço) — 0 min do time; (2) prepara ações que geram custo (reenvio, nova produção) e uma pessoa aprova em 1 clique — 2 min; (3) casos fora da política vão para uma pessoa — 12 min, como hoje."},
    {"id": "agente_capacidade", "texto": "O time tem 150 × 12 = 1.800 minutos por dia útil. No cenário com agente, esse tempo é gasto em ordem de prioridade: aprovações (2 min) e casos humanos (12 min)."},
]

LIMITE_VALOR_AGENTE = 200      # ≈ 2× o ticket médio das exceções (R$ 110), arredondado para baixo
MIN_TRATATIVA, MIN_APROVACAO = 12, 2
MINUTOS_DIA = CAPACIDADE_DIA * MIN_TRATATIVA
ACOES_COM_APROVACAO = {"reenvio_com_foto", "nova_producao", "reenvio_endereco"}
LIMITE_CONTATOS_AGENTE = 3
TIPOS_SEMPRE_HUMANO = {"extravio", "ruptura_pos_venda"}

ROTULOS = {
    "atraso_entrega": "Atraso na entrega", "extravio": "Extravio", "rastreio_parado": "Rastreio parado",
    "devolvido_transportadora": "Devolvido pela transportadora", "avaria_transporte": "Avaria no transporte",
    "vazamento_produto": "Vazamento", "item_faltante": "Item faltante",
    "falha_personalizacao": "Falha de personalização", "pagamento_pendente": "Pagamento pendente",
    "ruptura_pos_venda": "Ruptura pós-venda", "endereco_divergente": "Endereço divergente",
}


def D(serie):
    """Converte uma coluna de datas (texto) em datetime64[D]."""
    return np.array([str(x)[:10] for x in serie], dtype="datetime64[D]")


def bdays(a, b):
    """Dias úteis entre a e b (b > a → positivo)."""
    return np.busday_count(np.asarray(a, dtype="datetime64[D]"), np.asarray(b, dtype="datetime64[D]"), holidays=FERIADOS)


def add_bdays(a, n):
    return np.busday_offset(np.asarray(a, dtype="datetime64[D]"), n, roll="forward", holidays=FERIADOS)


# ---------------------------------------------------------------------------
# CARGA E ENRIQUECIMENTO
# ---------------------------------------------------------------------------
def carregar():
    e = pd.read_csv(os.path.join(DADOS, "pedidos_excecao.csv"))
    c = pd.read_csv(os.path.join(DADOS, "clientes.csv"))
    t = pd.read_csv(os.path.join(DADOS, "transportadoras.csv"))
    e = e.merge(c, on="customer_id", how="left")
    e = e.merge(t, left_on=["transportadora", "uf"], right_on=["transportadora", "uf_atendida"], how="left").drop(columns="uf_atendida")
    e["exc_id"] = [f"EX{i:04d}" for i in range(1, len(e) + 1)]

    # duplicados: mantém o primeiro registro de (pedido, tipo)
    e["duplicado"] = e.duplicated(subset=["order_id", "tipo_excecao"], keep="first")

    dp = D(e["data_pedido"])
    sla = e["sla_contratado_dias_uteis"].astype(int).values
    e["prazo_correto"] = add_bdays(add_bdays(dp, 1), sla)       # 1 dia útil de separação + SLA
    prom = D(e["data_prometida"])
    e["promessa_erro_dias"] = bdays(prom, e["prazo_correto"].values)
    entregue = e["data_entrega"].notna()
    e["entregue"] = entregue
    ref = np.where(entregue, D(e["data_entrega"].fillna("2000-01-01")), HOJE)
    e["atraso_vs_prometido"] = bdays(prom, ref)
    e["atraso_vs_correto"] = bdays(e["prazo_correto"].values, ref)
    e["falso_atraso"] = (e["tipo_excecao"] == "atraso_entrega") & (e["atraso_vs_prometido"] > 0) & (e["atraso_vs_correto"] <= 0)
    e["dias_aberta"] = bdays(D(e["data_abertura_excecao"]), np.full(len(e), HOJE))
    e["dias_pedido"] = (HOJE - dp).astype(int)

    e["vip"] = e["receita_acumulada"] > LIMIAR_VIP
    e["ticket_medio"] = e["receita_acumulada"] / e["n_pedidos"].clip(lower=1)
    e["p_recompra"] = np.where(e["vip"], P_RECOMPRA_VIP, P_RECOMPRA_DEMAIS)
    e["valor_cliente"] = e["p_recompra"] * e["ticket_medio"] * (1 - CMV) * MULT_RECOMPRA   # valor futuro esperado
    e["custo_reenvio"] = e["valor"] * CMV + e["custo_medio_frete"]
    return e


# ---------------------------------------------------------------------------
# CURVA DE PERDA: perda esperada se a exceção for tratada daqui a d dias úteis
# ---------------------------------------------------------------------------
def custo_resolucao(r):
    t = r["tipo_excecao"]
    if t in ("extravio", "avaria_transporte", "vazamento_produto", "falha_personalizacao"):
        return r["custo_reenvio"]
    if t == "item_faltante":
        return r["valor"] * CMV / max(r["qtd_itens"], 1) + r["custo_medio_frete"]
    if t == "devolvido_transportadora":
        return r["custo_medio_frete"]
    return 0.0


def perda(r, d, promessa_correta=False):
    """Perda esperada (R$) se a exceção for tratada no dia útil d (0 = hoje).
    promessa_correta=True simula o cenário sem o bug da data prometida."""
    if r["duplicado"]:
        return dict(cancel=0.0, resolucao=0.0, recompra=0.0, contatos=0.0, venda=0.0)
    t = r["tipo_excecao"]

    if t == "pagamento_pendente":
        idade = r["dias_pedido"] + d * 7 / 5          # dias corridos
        p_rec = 0.50 if idade <= 3 else 0.25 if idade <= 7 else 0.10 if idade <= 15 else 0.03
        return dict(cancel=0.0, resolucao=0.0, recompra=0.0, contatos=0.0, venda=r["valor"] * (1 - CMV) * (1 - p_rec))

    atraso_base = r["atraso_vs_correto"] if promessa_correta else r["atraso_vs_prometido"]
    if promessa_correta and r["falso_atraso"]:
        return dict(cancel=0.0, resolucao=0.0, recompra=0.0, contatos=0.0, venda=0.0)   # exceção nem existiria

    if t == "atraso_entrega" and r["entregue"]:
        # atraso encerrado: dano à recompra proporcional ao atraso que já aconteceu (custo afundado)
        mal = min(1.0, max(0.0, (atraso_base - MAL_INICIO) / MAL_RAMPA))
        return dict(cancel=0.0, resolucao=0.0, recompra=r["valor_cliente"] * FATOR_MAL_RESOLVIDA * mal, contatos=0.0, venda=0.0)

    pre_entrega = t in ("atraso_entrega", "rastreio_parado", "extravio")
    espera = r["dias_aberta"] + d
    atraso_cli = (atraso_base + d) if pre_entrega else espera
    pc = float(p_cancelamento(atraso_cli))
    mal = min(1.0, max(0.0, (espera - MAL_INICIO) / MAL_RAMPA))
    res = custo_resolucao(r)
    return dict(
        cancel=pc * r["valor"],
        resolucao=(1 - pc) * res,
        recompra=r["valor_cliente"] * FATOR_MAL_RESOLVIDA * mal,
        contatos=CUSTO_CONTATO * min(espera / CONTATO_A_CADA, 3),
        venda=0.0,
    )


def perda_total(r, d):
    return sum(perda(r, d).values())


# ---------------------------------------------------------------------------
# DECISÃO DO AGENTE (regras de elegibilidade + ação padrão)
# ---------------------------------------------------------------------------
def acao_padrao(r):
    t = r["tipo_excecao"]
    if r["duplicado"]:
        return "fechar_duplicado", "Fechar exceção duplicada"
    if t == "atraso_entrega" and r["entregue"]:
        return "comunicar_encerrar", "Enviar pedido de desculpas e encerrar"
    if r["falso_atraso"]:
        return "corrigir_promessa", "Avisar cliente da data correta (dentro do prazo real)"
    if t in ("atraso_entrega", "rastreio_parado"):
        return "acionar_transportadora", "Abrir chamado na transportadora e avisar cliente"
    if t == "pagamento_pendente":
        return ("lembrete_pagamento", "Enviar lembrete com novo link de pagamento") if r["dias_pedido"] <= 7 else ("cancelar_pagamento", "Cancelar pedido não pago e liberar estoque")
    if t == "endereco_divergente":
        return "confirmar_endereco", "Pedir confirmação de endereço ao cliente"
    if t == "falha_personalizacao":
        return "nova_producao", "Reproduzir personalização em outra impressora"
    if t in ("avaria_transporte", "vazamento_produto", "item_faltante"):
        return "reenvio_com_foto", "Pedir foto e reenviar sem custo (política)"
    if t == "devolvido_transportadora":
        return "reenvio_endereco", "Confirmar endereço e reenviar"
    if t == "extravio":
        return "decidir_reenvio_reembolso", "Decidir entre reenvio e reembolso + acionar seguro"
    if t == "ruptura_pos_venda":
        return "oferecer_troca_reembolso", "Oferecer troca ou reembolso ao cliente"
    return "analisar", "Analisar"


def agente_pode(r):
    if r["duplicado"] or (r["tipo_excecao"] == "atraso_entrega" and r["entregue"]):
        return True, "Caso de regra simples"
    if r["tipo_excecao"] in TIPOS_SEMPRE_HUMANO:
        return False, "Exige decisão de reembolso/troca"
    if r["valor"] > LIMITE_VALOR_AGENTE:
        return False, f"Pedido acima de R$ {LIMITE_VALOR_AGENTE}"
    if r["vip"]:
        return False, "Cliente VIP (receita > R$ 1.500)"
    if r["n_contatos_atendimento"] >= LIMITE_CONTATOS_AGENTE:
        return False, "Cliente já procurou o atendimento 3+ vezes"
    return True, "Dentro da política do agente"


# ---------------------------------------------------------------------------
# SIMULAÇÃO
# ---------------------------------------------------------------------------
HORIZONTE = 40


def simular(e, ordem, minutos):
    """Distribui a fila ordenada nos dias úteis conforme os minutos do time.
    minutos[i] = 0 → agente resolve sozinho no dia 0."""
    dia = pd.Series(0, index=e.index)
    usado, d = 0, 0
    for i in ordem:
        m = minutos[i]
        if m == 0:
            continue
        if usado + m > MINUTOS_DIA:
            d, usado = d + 1, 0
        usado += m
        dia[i] = d
    perdas = np.array([e.at[i, "curva"][min(dia[i], HORIZONTE)] for i in e.index])
    return dia, perdas


def main():
    e = carregar()
    e["curva"] = [[perda_total(r, d) for d in range(HORIZONTE + 1)] for _, r in e.iterrows()]
    comp0 = [perda(r, 0) for _, r in e.iterrows()]
    for k in ["cancel", "resolucao", "recompra", "contatos", "venda"]:
        e[f"hoje_{k}"] = [c[k] for c in comp0]
    e["perda_hoje"] = [c[0] for c in e["curva"]]
    e["perda_sem_bug"] = [sum(perda(r, 0, promessa_correta=True).values()) for _, r in e.iterrows()]
    e["perda_5d"] = [c[5] for c in e["curva"]]
    e["perda_20d"] = [c[20] for c in e["curva"]]
    e["score"] = e["perda_5d"] - e["perda_hoje"]          # quanto perdemos se esperar mais 1 semana
    acoes = [acao_padrao(r) for _, r in e.iterrows()]
    e["acao"] = [a[0] for a in acoes]
    e["acao_texto"] = [a[1] for a in acoes]
    pode = [agente_pode(r) for _, r in e.iterrows()]
    e["agente"] = [p[0] for p in pode]
    e["motivo_agente"] = [p[1] for p in pode]
    e["nivel"] = np.where(~e["agente"], "humano", np.where(e["acao"].isin(ACOES_COM_APROVACAO), "aprovacao", "auto"))
    e["min_agente"] = e["nivel"].map({"auto": 0, "aprovacao": MIN_APROVACAO, "humano": MIN_TRATATIVA})
    so_humano = pd.Series(MIN_TRATATIVA, index=e.index)

    ordem_fifo = e.sort_values(["data_abertura_excecao", "exc_id"]).index
    ordem_prio = e.sort_values(["score", "perda_hoje"], ascending=False).index
    cen = {}
    for nome, ordem, mins in [("fifo", ordem_fifo, so_humano), ("prioridade", ordem_prio, so_humano), ("agente", ordem_prio, e["min_agente"])]:
        dia, p = simular(e, ordem, mins)
        e[f"dia_{nome}"] = dia
        cen[nome] = dict(perda=float(p.sum()), dias_para_zerar=int(dia.max()) + 1)
    return e, cen


if __name__ == "__main__":
    e, cen = main()
    piso = e["perda_hoje"].sum()
    print(f"Exceções: {len(e)}  duplicadas: {e.duplicado.sum()}  valor em pedidos: R$ {e.valor.sum():,.0f}")
    print(f"Perda se tudo fosse resolvido hoje (piso, já afundada): R$ {piso:,.0f}")
    print(f"Perda se ninguém tratar por 20 dias úteis: R$ {e.perda_20d.sum():,.0f}")
    for k, v in cen.items():
        print(f"  {k:11s} perda R$ {v['perda']:>10,.0f}  evitável acima do piso R$ {v['perda']-piso:>9,.0f}  dias p/ zerar {v['dias_para_zerar']}")
    print(e.nivel.value_counts())
    print(e.groupby("tipo_excecao").agg(n=("exc_id", "size"), agente=("agente", "sum"), score_med=("score", "mean"), perda_hoje=("perda_hoje", "sum")).round(1))
