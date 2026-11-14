import pandas as pd, numpy as np, sys
from scipy.stats import binomtest
D='/home/claude/dados/case_operacoes/'
e=pd.read_csv(D+'pedidos_excecao.csv',parse_dates=['data_pedido','data_prometida','data_entrega','data_abertura_excecao'])
c=pd.read_csv(D+'clientes.csv'); e=e.merge(c,on='customer_id',how='left')
e['dow']=e.data_pedido.dt.day_name(); e['semana']=e.data_pedido.dt.isocalendar().week.astype(str)
e['faixa_valor']=pd.qcut(e.valor,4).astype(str); e['qtd']=e.qtd_itens.clip(upper=5).astype(str)
e['cliente_vip']=(e.receita_acumulada>1500).astype(str)
dims=['transportadora','uf','cidade','cd','turno','maquina','lote_produto','sku','marca','brinde_no_pedido','qtd','dow','semana','faixa_valor','status','cliente_vip']
rows=[]
for tipo in e.tipo_excecao.unique():
  base=(e.tipo_excecao==tipo).mean()
  for d in dims:
    g=e.groupby(d).agg(n=('order_id','size'),k=('tipo_excecao',lambda s:(s==tipo).sum()))
    for v,r in g.iterrows():
      if r.k<10: continue
      p=binomtest(int(r.k),int(r.n),base,alternative='greater').pvalue
      lift=(r.k/r.n)/base
      if p<1e-4 and lift>1.6: rows.append((tipo,d,v,int(r.k),int(r.n),round(r.k/r.n,2),round(base,2),round(lift,1),p))
out=pd.DataFrame(rows,columns=['tipo','dim','valor','k','n','taxa','base','lift','p']).sort_values(['tipo','p'])
pd.set_option('display.width',250); pd.set_option('display.max_rows',300)
print(out.to_string())
