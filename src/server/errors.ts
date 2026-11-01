/** Errors the user may read. Anything else is logged and shown as a generic failure. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function publicMessage(error: unknown) {
  if (error instanceof DomainError) return error.message;
  console.error("[ukuphila]", error);
  return "Não foi possível concluir agora. Tenta outra vez.";
}
