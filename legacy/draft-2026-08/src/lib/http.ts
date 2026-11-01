export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function jsonErro(mensagem: string, status = 400) {
  return Response.json({ erro: mensagem }, { status });
}
