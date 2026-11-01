import { prisma } from "@/lib/db";
import { json } from "@/lib/http";

export async function GET() {
  const user = await prisma.user.findUnique({
    where: { telefone: "841234567" },
    include: { pockets: true, agente: true },
  });
  return json({
    online: true,
    demo: user
      ? { telefone: "84 123 4567", codigo: "246810", nome: user.nome }
      : { precisa_semente: true },
  });
}
