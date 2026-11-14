# Central de Exceções — Desafio AI-First Gogroup (Problema 2: Operações)

Solução que prioriza, investiga e ajuda a resolver os pedidos com exceção, com dois agentes de IA.

> 🚧 Em desenvolvimento. README completo com números, premissas e instruções de deploy na versão final.

## Estrutura

```
analise/   Motor de cálculo em Python (valor em risco, simulação dos cenários, causas-raiz)
dados/     Dados do desafio (sintéticos)
app/       Site em Next.js (o que vai para o Vercel)
```

## Rodar localmente

```bash
# 1. (opcional) regenerar os dados do app
pip install pandas numpy scipy
python analise/exportar.py

# 2. rodar o site
cd app
npm install
npm run dev        # abre em http://localhost:3000
```
