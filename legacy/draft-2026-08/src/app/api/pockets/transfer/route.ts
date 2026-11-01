import { exigirUtilizador } from "@/lib/auth";
import { transferir } from "../route";

export async function POST(req: Request) {
  try {
    const user = await exigirUtilizador();
    return transferir(user.id, await req.json());
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
