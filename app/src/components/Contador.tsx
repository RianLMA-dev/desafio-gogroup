"use client";
import { useEffect, useRef, useState } from "react";

type Formato = "mil" | "inteiro" | "porcento_neg";

const formatar = (v: number, f: Formato) => {
  if (f === "mil") return `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil`;
  if (f === "porcento_neg") return `−${Math.round(v)}%`;
  return Math.round(v).toLocaleString("pt-BR");
};

/** Número que "conta" de 0 até o valor quando aparece na tela (respeita quem prefere menos movimento). */
export default function Contador({ valor, formato = "inteiro", duracao = 1100 }: { valor: number; formato?: Formato; duracao?: number }) {
  const [v, setV] = useState(valor);
  const iniciou = useRef(false);
  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / duracao);
      setV(valor * (1 - Math.pow(1 - p, 3)));   // desacelera no fim
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    setV(0);
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor, duracao]);
  return <span className="tabular">{formatar(v, formato)}</span>;
}
