import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/whatsapp/route";
import { verifyWebhookSignature } from "@/server/whatsapp";
import { webhookTexts } from "@/server/whatsapp/webhook";

afterEach(() => vi.unstubAllEnvs());

function event(numberId = "channel-1") {
  return { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: numberId }, messages: [{ from: "258841234567", id: "wamid.one", type: "text", text: { body: "Quanto tenho?" } }] } }] }] };
}

describe("webhook WhatsApp", () => {
  it("confirma o canal apenas com o token correcto", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "test-verification");
    const accepted = await GET(new Request("https://ukuphila.test/api/whatsapp?hub.mode=subscribe&hub.verify_token=test-verification&hub.challenge=12345"));
    expect(accepted.status).toBe(200);
    expect(await accepted.text()).toBe("12345");
    expect((await GET(new Request("https://ukuphila.test/api/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345"))).status).toBe(403);
  });

  it("a assinatura usa os bytes recebidos e detecta adulteração", () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "test-secret");
    const raw = JSON.stringify(event());
    const signature = `sha256=${createHmac("sha256", "test-secret").update(raw).digest("hex")}`;
    expect(verifyWebhookSignature(raw, signature)).toBe(true);
    expect(verifyWebhookSignature(`${raw} `, signature)).toBe(false);
    expect(verifyWebhookSignature(raw, null)).toBe(false);
  });

  it("só processa o número configurado e ignora notificações sem mensagem", () => {
    expect(webhookTexts(event(), "channel-1")).toEqual([{ phone: "258841234567", body: "Quanto tenho?", providerId: "wamid.one" }]);
    expect(webhookTexts(event("another-channel"), "channel-1")).toEqual([]);
    expect(webhookTexts({ object: "whatsapp_business_account", entry: [] }, "channel-1")).toEqual([]);
    expect(webhookTexts({ object: "invalid" }, "channel-1")).toBeNull();
  });

  it("recusa pedidos sem assinatura e JSON inválido antes de abrir a base", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "test-secret");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "channel-1");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "test-token");
    expect((await POST(new Request("https://ukuphila.test/api/whatsapp", { method: "POST", body: "{}" }))).status).toBe(401);
    const raw = "{";
    const signature = `sha256=${createHmac("sha256", "test-secret").update(raw).digest("hex")}`;
    expect((await POST(new Request("https://ukuphila.test/api/whatsapp", { method: "POST", body: raw, headers: { "x-hub-signature-256": signature } }))).status).toBe(400);
  });
});
