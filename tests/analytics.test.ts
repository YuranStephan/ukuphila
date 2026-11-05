import { describe, expect, it } from "vitest";
import { publicPageView } from "@/lib/analytics";

describe("public traffic analytics", () => {
  it("counts a public page without forwarding query tokens or fragments", () => {
    expect(publicPageView({ type: "pageview", url: "https://ukuphila.vercel.app/verificar?codigo=private-code#private-fragment" }))
      .toEqual({ type: "pageview", url: "https://ukuphila.vercel.app/verificar" });
  });

  it("removes the destination of a staff sign-in", () => {
    expect(publicPageView({ type: "pageview", url: "https://ukuphila.vercel.app/entrar?next=/gestao/comerciantes/private-id" }))
      .toEqual({ type: "pageview", url: "https://ukuphila.vercel.app/entrar" });
  });

  it.each(["/app", "/app/caixa", "/agente/comerciantes/private-id", "/gestao", "/risco/casos/private-id", "/fornecedor", "/h/private-code", "/api/site/contact"])("does not send the private or non-page route %s", (pathname) => {
    expect(publicPageView({ type: "pageview", url: `https://ukuphila.vercel.app${pathname}` })).toBeNull();
  });

  it("does not forward unknown paths, invalid URLs or custom events", () => {
    expect(publicPageView({ type: "pageview", url: "https://ukuphila.vercel.app/customer-name" })).toBeNull();
    expect(publicPageView({ type: "pageview", url: "invalid-url" })).toBeNull();
    expect(publicPageView({ type: "event", url: "https://ukuphila.vercel.app/" })).toBeNull();
  });

  it("normalises a public trailing slash", () => {
    expect(publicPageView({ type: "pageview", url: "https://ukuphila.vercel.app/agentes/?utm_source=market" }))
      .toEqual({ type: "pageview", url: "https://ukuphila.vercel.app/agentes" });
  });
});
