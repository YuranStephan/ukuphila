import { prisma } from "@/lib/db";
import { json, jsonErro } from "@/lib/http";
import { normalizarTelefone } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const telefone = normalizarTelefone(String(body.telefone || ""));
  if (telefone.length < 9) {
    return jsonErro("Escreve o número de telemóvel completo.");
  }

  const codigo = "246810";
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.otpChallenge.create({
    data: { telefone, codigo, expiresAt },
  });

  return json({
    ok: true,
    mensagem: "Enviámos um código para o teu telemóvel.",
    codigo_demo: codigo,
  });
}
