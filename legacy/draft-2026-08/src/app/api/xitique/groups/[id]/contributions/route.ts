import { POST as groupPost } from "../../[id]/route";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return groupPost(req, ctx);
}
