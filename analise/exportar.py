"""
Gera os arquivos JSON que o app consome (app/data/):
  resumo.json  — números principais, cenários, premissas
  fila.json    — uma linha por exceção, com score, nível do agente e ação
  causas.json  — causas-raiz com evidência, custo e pedidos afetados

Uso:  python analise/exportar.py
"""
import json, os
import numpy as np
import pandas as pd
import motor
from motor import ROTULOS, PREMISSAS, MIN_TRATATIVA

PERIODO_DIAS = 58          # pedidos de 01/08 a 27/09/2026
NE = ["BA", "PE", "CE", "RN", "PB", "AL", "SE", "PI", "MA"]


def r2(x):
    return float(round(float(x), 2))


# ---------------------------------------------------------------------------
# CAUSAS-RAIZ
# ---------------------------------------------------------------------------
def excesso(mask_grupo, mask_tipo, mask_comparacao):
    """Casos acima do esperado: k − n × taxa do grupo de comparação."""
    n, k = mask_grupo.sum(), (mask_grupo & mask_tipo).sum()
    base = (mask_comparacao & mask_tipo).sum() / max(mask_comparacao.sum(), 1)
    return int(k), int(n), float(base), max(0.0, k - n * base)


def tabela(e, mask_tipo, dim, filtro=None):
    sub = e if filtro is None else e[filtro]
    g = sub.groupby(dim).agg(total=("exc_id", "size"), casos=("tipo_excecao", lambda s: 0))
    g["casos"] = sub[mask_tipo.loc[sub.index]].groupby(dim).size().reindex(g.index).fillna(0).astype(int)
    g["taxa"] = (g["casos"] / g["total"]).round(3)
    return [{"grupo": str(i), "casos": int(r.casos), "total": int(r.total), "taxa": float(r.taxa)} for i, r in g.iterrows()]


def semanal(e, mask):
    s = pd.to_datetime(e.loc[mask, "data_pedido"]).dt.to_period("W").dt.start_time.dt.strftime("%Y-%m-%d")
    v = s.value_counts().sort_index()
    return [{"semana": k, "casos": int(x)} for k, x in v.items()]


def causas(e):
    t = e["tipo_excecao"]
    ok = ~e["duplicado"]
    C = []

    def add(id_, titulo, categoria, responsavel, mask_casos, fator_excesso, evidencia, causa, acoes, graf, resumo, monitorar=False, custo_override=None):
        casos = e[mask_casos & ok]
        frac = min(1.0, fator_excesso / max(len(casos), 1))
        custo_periodo = custo_override if custo_override is not None else casos["perda_hoje"].sum() * frac
        fator_excesso = min(fator_excesso, len(casos))
        C.append(dict(
            id=id_, titulo=titulo, categoria=categoria, responsavel=responsavel, resumo=resumo,
            evidencia=evidencia, causa_provavel=causa, acoes=acoes, grafico=graf,
            n_casos=int(len(casos)), casos_evitaveis=int(round(fator_excesso)),
            custo_periodo=r2(custo_periodo), custo_mensal=r2(custo_periodo * 30 / PERIODO_DIAS),
            horas_time_mes=r2(fator_excesso * MIN_TRATATIVA / 60 * 30 / PERIODO_DIAS),
            pedidos=casos.sort_values("score", ascending=False)["exc_id"].tolist(),
            monitorar=monitorar,
        ))

    # 1. Promessa em dias corridos — custo = perda atual − perda se a promessa estivesse certa
    m = e["falso_atraso"]
    custo_bug = float((e["perda_hoje"] - e["perda_sem_bug"])[ok].sum())
    add("promessa", "Prazo prometido calculado em dias corridos", "Sistema", "Tecnologia (checkout)",
        m, m.sum(),
        [f"100% das {len(e):,} datas prometidas = data do pedido + 1 + SLA em dias corridos; a regra é em dias úteis.".replace(",", "."),
         f"A promessa sai em média {e.promessa_erro_dias.mean():.1f} dias úteis antes do prazo possível (até {e.promessa_erro_dias.max()}).".replace(".", ",", 1),
         f"{int(m.sum())} dos {int((t=='atraso_entrega').sum())} atrasos ({m.sum()/(t=='atraso_entrega').sum():.0%}) estão dentro do prazo correto."],
        "O checkout soma o SLA da transportadora em dias corridos e ignora fins de semana e feriados (07/09).",
        ["Corrigir o cálculo da data prometida para dias úteis com calendário de feriados.",
         "Avisar os clientes com 'falso atraso' da data correta (Agente de Fila já faz)."],
        dict(tipo="barras", titulo="Diferença entre promessa e prazo correto (dias úteis)",
             dados=[{"grupo": f"{k} dia(s)", "casos": int(v)} for k, v in e.promessa_erro_dias.value_counts().sort_index().items()]),
        "Quase um terço dos atrasos (30%) não são atrasos: o sistema promete um prazo que a operação não consegue cumprir.",
        custo_override=custo_bug)

    # 2. Rota Express no Nordeste
    rota_ne = (e.transportadora == "Rota Express") & e.uf.isin(NE)
    outras_ne = (e.transportadora != "Rota Express") & e.uf.isin(NE)
    atr = (t.isin(["atraso_entrega", "rastreio_parado"])) & ~e["falso_atraso"]
    k, n, base, exc = excesso(rota_ne, atr, outras_ne)
    add("rota_ne", "Rota Express atrasando no Nordeste", "Transportadora", "Logística (gestão de transportadoras)",
        rota_ne & atr, exc,
        [f"No Nordeste, {k/n:.0%} das exceções da Rota Express são atraso ou rastreio parado; nas outras transportadoras da região, {base:.0%}.",
         "Concentrado em PB (João Pessoa, Campina Grande), PE, RN (Natal, Mossoró), CE e BA.",
         "Piorou a partir da semana de 31/08: os atrasos semanais mais que dobraram."],
        "Queda de desempenho da Rota Express na malha do Nordeste desde o fim de agosto (capacidade, hub regional ou mudança operacional).",
        ["Cobrar o SLA contratado e plano de ação da Rota Express.",
         "Redirecionar pedidos para PB, RN e PE a outra transportadora até normalizar.",
         "Abrir chamado em lote para os pedidos parados (Agente de Fila já faz)."],
        dict(tipo="linha", titulo="Atrasos por semana — Rota Express no Nordeste", dados=semanal(e, rota_ne & atr)),
        "A Rota Express concentra a maior parte dos atrasos reais, quase todos no Nordeste, e piorou desde 31/08.")

    # 3. Carga Norte avaria
    cn = e.transportadora == "Carga Norte"
    av = t == "avaria_transporte"
    k, n, base, exc = excesso(cn, av, ~cn)
    add("carga_norte", "Carga Norte danificando produtos frágeis", "Transportadora", "Logística (gestão de transportadoras)",
        cn & av, exc,
        [f"{k} das {int(av.sum())} avarias são da Carga Norte: {k/n:.0%} das exceções dela, contra {base:.0%} nas outras.",
         "Concentrado em fragrâncias e itens em vidro: Lescent, Barbour's e Rituária (todas as avarias Rituária foram com ela)."],
        "Manuseio inadequado de volumes frágeis na Carga Norte (ou embalagem insuficiente para vidro nessa rota).",
        ["Cobrar ressarcimento das avarias da Carga Norte.",
         "Exigir manuseio de frágil ou reforçar a embalagem de fragrâncias enviadas por ela.",
         "Avaliar trocar a transportadora para itens em vidro."],
        dict(tipo="barras", titulo="% das exceções que são avaria, por transportadora", dados=tabela(e, av, "transportadora")),
        "Na Carga Norte, avaria é 6 vezes mais frequente que nas outras transportadoras, principalmente com perfumes e frascos de vidro.")

    # 4. IMP-02
    gc = e.marca == "Gocase"
    imp2 = e.maquina == "IMP-02"
    fp = t == "falha_personalizacao"
    k, n, base, exc = excesso(imp2, fp, gc & ~imp2)
    add("imp02", "Impressora IMP-02 com defeito", "Produção", "Manutenção (CD1)",
        imp2 & fp, exc,
        [f"{k} das {int(fp.sum())} falhas de personalização vêm da IMP-02: {k/n:.0%} dos pedidos dela com exceção, contra {base:.0%} nas outras 5 impressoras.",
         "Falha nos 3 turnos — não é operador, é a máquina.",
         "Começou por volta de 24/08 e está piorando (de 0–3 para 11–18 falhas por semana)."],
        "Defeito na IMP-02 (cabeçote, calibração ou alinhamento) surgido no fim de agosto.",
        ["Parar a IMP-02 para manutenção e calibração.",
         "Redirecionar a produção para IMP-01 e IMP-03 enquanto isso.",
         "Reproduzir as personalizações com falha em outra impressora (Agente de Fila já faz)."],
        dict(tipo="linha", titulo="Falhas da IMP-02 por semana", dados=semanal(e, imp2 & fp)),
        "Uma impressora sozinha gera mais da metade das falhas de personalização, e piora a cada semana.")

    # 5. CD2 noite + brinde
    cd2n = (e.cd == "CD2") & (e.turno == "noite")
    itf = t == "item_faltante"
    k, n, base, exc = excesso(cd2n, itf, ~cd2n)
    brinde = int((cd2n & itf & e.brinde_no_pedido).sum())
    add("cd2_noite", "Separação de kits com brinde no CD2, turno da noite", "Processo de separação", "Gestão do CD2",
        cd2n & itf, exc,
        [f"{k} dos {int(itf.sum())} itens faltantes saíram do CD2 no turno da noite ({k/n:.0%} das exceções desse turno, contra {base:.0%} no resto).",
         f"{brinde} deles são pedidos de campanha com brinde.",
         "Constante desde o início de agosto: é processo, não um evento."],
        "Na montagem dos pedidos com brinde, o turno da noite do CD2 esquece itens (falta de conferência ou checklist do kit).",
        ["Conferência obrigatória (bipagem ou peso) para pedidos com brinde no CD2 à noite.",
         "Treinar a equipe da noite na montagem de kits de campanha.",
         "Pedir foto e reenviar o item faltante (Agente de Fila já faz)."],
        dict(tipo="barras", titulo="Itens faltantes por CD e turno",
             dados=[{"grupo": f"{a} · {b}", "casos": int(v)} for (a, b), v in e[itf].groupby(["cd", "turno"]).size().items()]),
        "Três de cada quatro itens faltantes vêm de um único turno de um único CD, quase sempre em pedidos com brinde.")

    # 6. Lote L2607-B
    lote = (e.lote_produto == "L2607-B") & (e.sku == "APC-1067")
    vz = t == "vazamento_produto"
    k = int((lote & vz).sum())
    add("lote", "Lote L2607-B do Condicionador Ápice 1000ml com defeito", "Fornecedor / qualidade", "Qualidade e Compras",
        lote & vz, k,
        [f"{k} dos {int(vz.sum())} vazamentos são do mesmo produto e lote: Cond Ativ Anti-Frizz Ápice 1000ml, lote L2607-B.",
         f"{int((e.sku=='APC-1067').pipe(lambda s: (s & vz).sum()))} dos {int((e.sku=='APC-1067').sum())} problemas desse produto são vazamento.",
         "Nenhum outro lote passa de 6 vazamentos."],
        "Defeito de fabricação no lote (tampa, lacre ou envase).",
        ["Bloquear o estoque restante do lote L2607-B.",
         "Acionar o fornecedor e pedir ressarcimento.",
         "Reenviar de outro lote e checar pedidos ainda não entregues com esse lote."],
        dict(tipo="barras", titulo="Vazamentos por lote (top 6)",
             dados=[{"grupo": k_, "casos": int(v)} for k_, v in e[vz].lote_produto.value_counts().head(6).items()]),
        "Um único lote de um único produto responde por dois de cada três vazamentos (76 de 113).")

    # 7. Ruptura Kokeshi
    ksh = e.sku.isin(["KSH-1009", "KSH-1010", "KSH-1011"])
    rp = t == "ruptura_pos_venda"
    k, n, base, exc = excesso(ksh, rp, ~ksh)
    add("kokeshi", "Site vendendo produtos Kokeshi sem estoque", "Estoque / sistema", "E-commerce e Planejamento",
        ksh & rp, exc,
        [f"{k} das {int(rp.sum())} rupturas pós-venda são de 3 produtos Kokeshi: Óleo de Rosa Mosqueta, Geleia Facial de Colágeno e Sérum Adeus Olheiras.",
         "No Óleo de Rosa Mosqueta (KSH-1010), 75% das exceções são ruptura.",
         "Acontece toda semana, desde agosto."],
        "Estoque desses SKUs não está sincronizado com o site (ou sem estoque de segurança).",
        ["Revisar a sincronização de estoque desses SKUs com o site.",
         "Criar estoque de segurança ou pausar a venda quando o saldo ficar baixo.",
         "Oferecer troca ou reembolso aos clientes afetados (pessoa decide)."],
        dict(tipo="barras", titulo="Rupturas pós-venda por produto (top 6)",
             dados=[{"grupo": k_, "casos": int(v)} for k_, v in e[rp].sku.value_counts().head(6).items()]),
        "Três produtos Kokeshi são vendidos sem estoque toda semana.")

    # 8. Duplicados
    dup = e["duplicado"]
    C.append(dict(
        id="duplicados", titulo="Exceções registradas em duplicidade", categoria="Sistema", responsavel="Tecnologia (abertura de exceções)",
        resumo="42 pedidos aparecem duas vezes na fila com a mesma exceção, consumindo tratativas à toa.",
        evidencia=[f"{int(dup.sum())} exceções têm o mesmo pedido e o mesmo tipo de outra já aberta, muitas vezes com status diferentes."],
        causa_provavel="A abertura de exceção não verifica se já existe uma aberta para o mesmo pedido e tipo.",
        acoes=["Bloquear abertura duplicada no sistema.", "Fechar as duplicadas (Agente de Fila já faz)."],
        grafico=None, n_casos=int(dup.sum()), casos_evitaveis=int(dup.sum()), custo_periodo=0.0, custo_mensal=0.0,
        horas_time_mes=r2(dup.sum() * MIN_TRATATIVA / 60 * 30 / PERIODO_DIAS),
        pedidos=e[dup]["exc_id"].tolist(), monitorar=False))

    # 9. Fila envelhecida
    velha = (e.dias_aberta > 20) & ok
    pg = (t == "pagamento_pendente") & ok
    C.append(dict(
        id="fila_velha", titulo="Fila envelhecida e pagamentos esquecidos", categoria="Gestão da fila", responsavel="Liderança de Operações",
        resumo=f"{int(velha.sum())} exceções estão abertas há mais de 20 dias úteis; pagamentos pendentes estão parados há {pg.sum() and int(e[pg].dias_pedido.median())} dias em média.",
        evidencia=[f"{int(velha.sum())} exceções abertas há mais de 20 dias úteis (cerca de 1 mês).",
                   f"Pagamento pendente: mediana de {int(e[pg].dias_pedido.median())} dias desde o pedido — pix e boleto já expiraram.",
                   "Tratar por ordem de chegada gasta a capacidade em casos cujo dano já aconteceu."],
        causa_provavel="A fila é tratada por ordem de chegada, sem prioridade nem automação dos casos simples.",
        acoes=["Priorizar por valor em risco (esta solução).", "Cancelar automaticamente pedidos não pagos após 7 dias e liberar estoque.",
               "Automatizar os casos de regra simples com o Agente de Fila."],
        grafico=None, n_casos=int(velha.sum()), casos_evitaveis=0, custo_periodo=r2(e[velha].perda_hoje.sum()), custo_mensal=0.0,
        horas_time_mes=0.0, pedidos=e[velha].sort_values("score", ascending=False)["exc_id"].tolist(), monitorar=False))

    # Em observação
    bh = (e.cidade == "Belo Horizonte") & (t == "extravio")
    C.append(dict(
        id="bh_extravio", titulo="Extravios em Belo Horizonte", categoria="Em observação", responsavel="Logística",
        resumo="Sinal fraco: 10 extravios em BH, espalhados em 4 transportadoras. Monitorar, sem ação agora.",
        evidencia=["10 de 74 exceções em Belo Horizonte são extravio (4,6x a média).",
                   "Espalhados em 4 transportadoras e 2 CDs, sem semana específica; R$ 817 no total."],
        causa_provavel="Inconclusivo — pode ser acaso ou risco local de entrega.",
        acoes=["Monitorar nas próximas semanas."], grafico=None,
        n_casos=int(bh.sum()), casos_evitaveis=0, custo_periodo=r2(e[bh].perda_hoje.sum()), custo_mensal=0.0, horas_time_mes=0.0,
        pedidos=e[bh]["exc_id"].tolist(), monitorar=True))
    return C


# ---------------------------------------------------------------------------
def main():
    e, cen = motor.main()
    os.makedirs(motor.SAIDA, exist_ok=True)
    piso = float(e["perda_hoje"].sum())

    # mapa exceção → causas
    lista_causas = causas(e)
    causa_de = {}
    for c in lista_causas:
        if c["id"] in ("fila_velha",):
            continue
        for p in c["pedidos"]:
            causa_de.setdefault(p, []).append(c["id"])

    # ---- fila.json
    ordem = e.sort_values(["score", "perda_hoje"], ascending=False)
    fila = []
    for rank, (_, r) in enumerate(ordem.iterrows(), 1):
        fila.append(dict(
            id=r.exc_id, rank=rank, pedido=r.order_id, cliente=r.customer_id, marca=r.marca, produto=r.descricao_produto, sku=r.sku,
            itens=int(r.qtd_itens), brinde=bool(r.brinde_no_pedido), valor=r2(r.valor),
            tipo=r.tipo_excecao, tipo_rotulo=ROTULOS[r.tipo_excecao], status=r.status,
            transportadora=r.transportadora, uf=r.uf, cidade=r.cidade, cd=r.cd, turno=r.turno,
            maquina=None if pd.isna(r.maquina) else r.maquina, lote=r.lote_produto,
            data_pedido=r.data_pedido, data_prometida=r.data_prometida, prazo_correto=str(r.prazo_correto)[:10],
            data_entrega=None if pd.isna(r.data_entrega) else r.data_entrega, data_abertura=r.data_abertura_excecao,
            atraso_prometido=int(r.atraso_vs_prometido), atraso_real=int(r.atraso_vs_correto), falso_atraso=bool(r.falso_atraso),
            dias_aberta=int(r.dias_aberta), duplicado=bool(r.duplicado),
            cli_pedidos=int(r.n_pedidos), cli_receita=r2(r.receita_acumulada), cli_contatos=int(r.n_contatos_atendimento), vip=bool(r.vip),
            sla=int(r.sla_contratado_dias_uteis), frete=r2(r.custo_medio_frete),
            perda_hoje=r2(r.perda_hoje), perda_5d=r2(r.perda_5d), score=r2(r.score),
            comp=dict(cancelamento=r2(r.hoje_cancel), resolucao=r2(r.hoje_resolucao), recompra=r2(r.hoje_recompra),
                      contatos=r2(r.hoje_contatos), venda=r2(r.hoje_venda)),
            acao=r.acao, acao_texto=r.acao_texto, nivel=r.nivel, motivo_nivel=r.motivo_agente,
            causas=causa_de.get(r.exc_id, []),
            dia_fifo=int(r.dia_fifo), dia_prioridade=int(r.dia_prioridade), dia_agente=int(r.dia_agente),
        ))
    json.dump(fila, open(os.path.join(motor.SAIDA, "fila.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    # ---- curvas por dia (fila restante e perda acumulada evitável)
    curvas = []
    max_d = max(int(e[f"dia_{k}"].max()) for k in cen) + 1
    for d in range(max_d + 1):
        linha = {"dia": d}
        for k in cen:
            linha[f"restante_{k}"] = int((e[f"dia_{k}"] >= d).sum()) if d > 0 else len(e)
        curvas.append(linha)

    nivel = e["nivel"].value_counts().to_dict()
    top150 = ordem.head(150)
    resumo = dict(
        data_referencia="2026-09-30",
        n_excecoes=len(e), n_duplicadas=int(e.duplicado.sum()), valor_pedidos=r2(e.valor.sum()),
        perda_piso=r2(piso), perda_sem_tratar_20d=r2(e.perda_20d.sum()),
        cenarios={k: dict(perda=r2(v["perda"]), evitavel=r2(v["perda"] - piso), dias_para_zerar=v["dias_para_zerar"]) for k, v in cen.items()},
        economia_prioridade=r2(cen["fifo"]["perda"] - cen["prioridade"]["perda"]),
        economia_agente=r2(cen["fifo"]["perda"] - cen["agente"]["perda"]),
        niveis={k: int(v) for k, v in nivel.items()},
        minutos_time_agente=int(e["min_agente"].sum()), minutos_time_hoje=int(len(e) * MIN_TRATATIVA),
        top150_espera_fifo=r2(top150.dia_fifo.mean()),
        componentes_piso={k: r2(e[f"hoje_{k}"].sum()) for k in ["cancel", "resolucao", "recompra", "contatos", "venda"]},
        por_tipo=[dict(tipo=k, rotulo=ROTULOS[k], n=int(len(g)), valor=r2(g.valor.sum()), perda_hoje=r2(g.perda_hoje.sum()),
                       score_medio=r2(g.score.mean()), auto=int((g.nivel == "auto").sum()), aprovacao=int((g.nivel == "aprovacao").sum()),
                       humano=int((g.nivel == "humano").sum()))
                  for k, g in e.groupby("tipo_excecao")],
        curvas=curvas,
        causas_custo_mensal=r2(sum(c["custo_mensal"] for c in lista_causas)),
        causas_horas_mes=r2(sum(c["horas_time_mes"] for c in lista_causas)),
        premissas=PREMISSAS,
    )
    json.dump(resumo, open(os.path.join(motor.SAIDA, "resumo.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(lista_causas, open(os.path.join(motor.SAIDA, "causas.json"), "w"), ensure_ascii=False, indent=1)
    return resumo, lista_causas


if __name__ == "__main__":
    res, cs = main()
    print(json.dumps({k: v for k, v in res.items() if k not in ("curvas", "premissas", "por_tipo")}, ensure_ascii=False, indent=1))
    for c in cs:
        print(f"{c['id']:12s} casos {c['n_casos']:4d} evitáveis {c['casos_evitaveis']:4d}  R$/mês {c['custo_mensal']:>9,.0f}  h/mês {c['horas_time_mes']:5.1f}")
