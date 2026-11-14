import { NextResponse } from "next/server";
import { getExcecao, tituloCausa } from "@/lib/data";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getExcecao(id);
  if (!e) return NextResponse.json({ erro: "não encontrada" }, { status: 404 });
  return NextResponse.json({ ...e, causas_titulos: e.causas.map((c) => ({ id: c, titulo: tituloCausa[c] })) });
}
