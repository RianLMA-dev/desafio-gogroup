"""
Análise de robustez: a conclusão se mantém se as premissas estiverem erradas?

Roda o motor inteiro (prioridade + simulação dos 3 cenários) variando, uma de cada vez,
as premissas mais incertas — e uma combinação pessimista de todas.

Uso:  python analise/robustez.py   → gera app/src/data/robustez.json
"""
import json, os, importlib
import motor

CENARIOS = [
    ("base", "Premissas do modelo", {}),
    ("mal_lento", "Cliente tolera mais espera (mal resolvida só de 5 a 20 dias)", {"MAL_INICIO": 5, "MAL_RAMPA": 15}),
    ("mal_rapido", "Cliente tolera menos espera (mal resolvida de 1 a 5 dias)", {"MAL_INICIO": 1, "MAL_RAMPA": 4}),
    ("cancel_menos", "Cancelamentos 50% menores que a tabela", {"MULT_CANCEL": 0.5}),
    ("cancel_mais", "Cancelamentos 50% maiores que a tabela", {"MULT_CANCEL": 1.5}),
    ("recompra_menos", "Valor da recompra pela metade", {"MULT_RECOMPRA": 0.5}),
    ("recompra_mais", "Valor da recompra em dobro", {"MULT_RECOMPRA": 2.0}),
    ("sem_contatos", "Cliente nunca procura o atendimento", {"CONTATO_A_CADA": 10**9}),
    ("aprovacao_5min", "Aprovar uma ação leva 5 min, não 2", {"MIN_APROVACAO": 5}),
    ("capacidade_menor", "Time trata 120 por dia, não 150", {"CAPACIDADE_DIA": 120, "MINUTOS_DIA": 120 * 12}),
    ("pessimista", "Tudo junto, no pior sentido para a solução",
     {"MAL_INICIO": 5, "MAL_RAMPA": 15, "MULT_CANCEL": 0.5, "MULT_RECOMPRA": 0.5, "MIN_APROVACAO": 5}),
]


def rodar(ajustes):
    importlib.reload(motor)                     # volta tudo ao padrão
    for k, v in ajustes.items():
        setattr(motor, k, v)
    e, cen = motor.main()
    piso = e["perda_hoje"].sum()
    fifo, prio, ag = (cen[k]["perda"] - piso for k in ("fifo", "prioridade", "agente"))
    return dict(
        evitavel_fifo=round(fifo), evitavel_prioridade=round(prio), evitavel_agente=round(ag),
        economia_prioridade=round(fifo - prio), economia_agente=round(fifo - ag),
        pct_recuperado=round((fifo - ag) / fifo, 3) if fifo else None,
        dias_fifo=cen["fifo"]["dias_para_zerar"], dias_agente=cen["agente"]["dias_para_zerar"],
    )


if __name__ == "__main__":
    saida = []
    for id_, rotulo, aj in CENARIOS:
        r = rodar(aj)
        saida.append(dict(id=id_, rotulo=rotulo, **r))
        print(f"{rotulo[:58]:58s} economia agente R$ {r['economia_agente']:>7,}  ({r['pct_recuperado']:.0%})  "
              f"prioridade R$ {r['economia_prioridade']:>7,}  dias {r['dias_agente']} vs {r['dias_fifo']}")
    importlib.reload(motor)
    destino = os.path.join(motor.SAIDA, "robustez.json")
    json.dump(saida, open(destino, "w"), ensure_ascii=False, indent=1)
    print("salvo em", destino)
