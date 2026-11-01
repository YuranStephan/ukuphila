import { exigirUtilizador } from "@/lib/auth";
import { json, jsonErro } from "@/lib/http";
import { prisma } from "@/lib/db";
import { AccaoSync, aplicarTransacao, estadoCanonico } from "@/lib/sync";
import { transferir } from "@/app/api/pockets/route";

export async function POST(req: Request) {
  try {
    const user = await exigirUtilizador();
    const body = await req.json();
    const acoes = (body.acoes || []) as AccaoSync[];
    const resultados = [];

    for (const accao of acoes) {
      const uuid = accao.client_uuid;
      if (!uuid) continue;
      const ja = await prisma.syncAction.findUnique({ where: { clientUuid: uuid } });
      if (ja) {
        resultados.push({ client_uuid: uuid, estado: "ja_aplicado" });
        continue;
      }

      try {
        if (accao.tipo === "transacao") {
          const p = accao.payload;
          await aplicarTransacao({
            userId: user.id,
            pocketId: String(p.pocket_id),
            tipo: p.tipo === "compra" ? "compra" : "venda",
            valor: Number(p.valor),
            produtoId: (p.produto_id as string) || null,
            metodoRegisto: String(p.metodo_registo || "texto"),
            clientUuid: uuid,
            criadoEm: accao.timestamp ? new Date(accao.timestamp) : new Date(),
            quantidadeExtra: p.quantidade != null ? Number(p.quantidade) : null,
          });
        } else if (accao.tipo === "transferencia") {
          await transferir(user.id, {
            ...(accao.payload as { de?: string; para?: string; valor?: number }),
            client_uuid: uuid,
          });
        } else if (accao.tipo === "inventario") {
          const p = accao.payload;
          if (p.id) {
            await prisma.inventoryItem.updateMany({
              where: { id: String(p.id), userId: user.id },
              data: { quantidadeAtual: Number(p.quantidade_atual), atualizadoEm: new Date() },
            });
          }
        }

        await prisma.syncAction.create({
          data: {
            userId: user.id,
            clientUuid: uuid,
            tipo: accao.tipo,
            payload: JSON.stringify(accao.payload),
            timestamp: accao.timestamp ? new Date(accao.timestamp) : new Date(),
          },
        });
        resultados.push({ client_uuid: uuid, estado: "aplicado" });
      } catch (err) {
        resultados.push({
          client_uuid: uuid,
          estado: "erro",
          mensagem: err instanceof Error ? err.message : "Não deu para guardar isto agora.",
        });
      }
    }

    const canonico = await estadoCanonico(user.id);
    return json({ resultados, estado: canonico });
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonErro("Não conseguimos guardar isto agora. Vamos tentar outra vez quando tiveres rede.");
  }
}
