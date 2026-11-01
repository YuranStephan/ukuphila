import { exigirUtilizador } from "@/lib/auth";
import { json } from "@/lib/http";
import { jornada } from "@/lib/kyc";

export async function GET() {
  try {
    const user = await exigirUtilizador();
    return json({
      ...user,
      jornada: jornada(user.nivelKyc, user.diasComTransacoes),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await exigirUtilizador();
    const body = await req.json().catch(() => ({}));
    const { prisma } = await import("@/lib/db");
    const actualizado = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(typeof body.nome === "string" ? { nome: body.nome } : {}),
        ...(typeof body.foto_url === "string" ? { fotoUrl: body.foto_url } : {}),
        ...(typeof body.idioma === "string" ? { idioma: body.idioma } : {}),
        ...(typeof body.notificacoes === "boolean" ? { notificacoes: body.notificacoes } : {}),
      },
      include: { agente: true },
    });
    return json(actualizado);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
