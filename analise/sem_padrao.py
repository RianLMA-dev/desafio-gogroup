import pandas as pd, numpy as np
from scipy.stats import chi2_contingency, binomtest
D='/home/claude/dados/case_operacoes/'
e=pd.read_csv(D+'pedidos_excecao.csv',parse_dates=['data_pedido','data_prometida','data_entrega','data_abertura_excecao'])
c=pd.read_csv(D+'clientes.csv'); e=e.merge(c,on='customer_id',how='left')
e['dow']=e.data_pedido.dt.dayofweek.astype(str); e['semana']=e.data_pedido.dt.to_period('W').astype(str).str[:10]
e['faixa_valor']=pd.qcut(e.valor,4).astype(str); e['qtd']=e.qtd_itens.clip(upper=5).astype(str)
e['novo']=(e.n_pedidos<=1).astype(str); e['vip']=(e.receita_acumulada>1500).astype(str)
e['contatos']=e.n_contatos_atendimento.clip(upper=3).astype(str)
dims=['transportadora','uf','cidade','cd','turno','maquina','lote_produto','sku','marca','brinde_no_pedido','qtd','dow','semana','faixa_valor','novo','vip','contatos']
pd.set_option('display.width',250)
for tipo in ['endereco_divergente','devolvido_transportadora','extravio','pagamento_pendente']:
  y=(e.tipo_excecao==tipo); base=y.mean(); print(f'\n=== {tipo}  n={y.sum()}  taxa base={base:.1%}')
  for d in dims:
    x=e[d].fillna('NA'); ct=pd.crosstab(x,y)
    if ct.shape[0]<2: continue
    p=chi2_contingency(ct)[1]
    g=e.groupby(x).agg(n=('order_id','size'),k=('tipo_excecao',lambda s:(s==tipo).sum())); g=g[g.n>=30]
    g['taxa']=g.k/g.n; top=g.sort_values('taxa').iloc[-1]
    pb=binomtest(int(top.k),int(top.n),base,alternative='greater').pvalue*len(g)  # Bonferroni
    flag=' <-- sinal' if p<0.001 else ''
    print(f'  {d:16s} chi2 p={p:8.4f}  maior: {str(top.name)[:22]:22s} {int(top.k):3d}/{int(top.n):4d} ({top.taxa:.0%}, {top.taxa/base:.1f}x) p_ajust={min(pb,1):.3f}{flag}')
