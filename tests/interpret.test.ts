import { describe, expect, it } from "vitest";
import { interpret, parseWalletSms } from "@/lib/interpret";
import { findNumbers, normalizeText } from "@/lib/interpret/numbers";
import { formatMT, parseAmountToCents } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";

describe("números em português", () => {
  it.each([
    ["mil e quinhentos", 1500],
    ["dois mil", 2000],
    ["quinhentos e cinquenta", 550],
    ["trezentos", 300],
    ["cento e vinte", 120],
    ["dez mil e duzentos", 10200],
    ["2 mil", 2000],
    ["1.500", 1500],
    ["um milhao", 1_000_000],
  ])("%s", (text, expected) => {
    expect(findNumbers(normalizeText(text))[0].value).toBe(expected);
  });
});

describe("intérprete", () => {
  it("entende o exemplo do documento: vendi duas caixas por mil meticais", () => {
    expect(interpret("Vendi duas caixas por mil meticais")).toMatchObject({ intent: "RECORD_SALE", amountCents: 100_000, quantity: 2, item: "caixas" });
  });
  it("venda só com valor", () => {
    expect(interpret("Vendi 500")).toMatchObject({ intent: "RECORD_SALE", amountCents: 50_000 });
  });
  it("despesa com categoria", () => {
    expect(interpret("Gastei 150 de transporte")).toMatchObject({ intent: "RECORD_EXPENSE", amountCents: 15_000, category: "transporte" });
    expect(interpret("Paguei a taxa do mercado 50 meticais")).toMatchObject({ intent: "RECORD_EXPENSE", category: "taxa_mercado", amountCents: 5_000 });
  });
  it("compra de stock", () => {
    expect(interpret("Comprei 10 sacos de cebola por 8000")).toMatchObject({ intent: "RECORD_PURCHASE", amountCents: 800_000, quantity: 10 });
  });
  it("retirada para casa e poupança", () => {
    expect(interpret("Tirei 2000 para casa")).toMatchObject({ intent: "TRANSFER_HOME", amountCents: 200_000 });
    expect(interpret("Guardei 500")).toMatchObject({ intent: "RECORD_SAVING", amountCents: 50_000 });
  });
  it("venda a fiado e pagamento do fiado", () => {
    expect(interpret("Vendi 800 a fiado para a Rita")).toMatchObject({ intent: "RECORD_FIADO_SALE", amountCents: 80_000, person: "Rita" });
    expect(interpret("A Rita pagou 300 do fiado")).toMatchObject({ intent: "FIADO_REPAID", amountCents: 30_000, person: "Rita" });
  });
  it.each([
    ["Quanto tenho?", "CHECK_BALANCE"],
    ["Como foi hoje?", "DAILY_SUMMARY"],
    ["Meu documento foi aprovado?", "DOCUMENT_STATUS"],
    ["O que falta?", "KYC_HELP"],
    ["Quanto falta para o Xitique?", "XITIQUE_STATUS"],
    ["Quanto já poupei?", "SAVINGS_STATUS"],
    ["Como funciona o crédito?", "CREDIT_INFO"],
    ["Quero falar com alguém", "HUMAN_SUPPORT"],
    ["Quem me deve?", "FIADO_STATUS"],
  ])("intenção do documento: %s", (text, intent) => {
    expect(interpret(text).intent).toBe(intent);
  });
  it("sim e não curtos confirmam; frases longas não", () => {
    expect(interpret("sim").intent).toBe("CONFIRM_YES");
    expect(interpret("Não").intent).toBe("CONFIRM_NO");
    expect(interpret("sim eu vendi 500").intent).not.toBe("CONFIRM_YES");
  });
  it("um valor solto nunca vira movimento", () => {
    expect(interpret("300")).toMatchObject({ intent: "UNKNOWN", amountCents: 30_000 });
  });
  it("venda sem valor fica com confiança baixa", () => {
    expect(interpret("vendi tomate").confidence).toBeLessThan(0.62);
  });
});

describe("SMS de carteira", () => {
  it("recebido vira proposta de venda", () => {
    expect(parseWalletSms("Confirmado TX123. Recebeste 1,500.00MT de 841234567 em 10/11/26.")).toMatchObject({ intent: "RECORD_SALE", amountCents: 150_000 });
  });
  it("enviado vira proposta de despesa", () => {
    expect(parseWalletSms("M-Pesa: Transferiste 250MT para 845556677")).toMatchObject({ intent: "RECORD_EXPENSE", amountCents: 25_000 });
  });
  it("texto normal não é SMS", () => {
    expect(parseWalletSms("Vendi duas caixas")).toBeNull();
  });
});

describe("dinheiro e telefone", () => {
  it("formata com espaço fino e sinal", () => {
    expect(formatMT(125_000)).toBe("1 250 MT");
    expect(formatMT(-5_050)).toBe("−50,50 MT");
  });
  it("lê valores comuns", () => {
    expect(parseAmountToCents("1 500")).toBe(150_000);
    expect(parseAmountToCents("1.500")).toBe(150_000);
    expect(parseAmountToCents("1500,50")).toBe(150_050);
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("0")).toBeNull();
  });
  it("normaliza telemóveis de Moçambique", () => {
    expect(normalizePhone("84 123 4567")).toBe("+258841234567");
    expect(normalizePhone("+258 87 123 4567")).toBe("+258871234567");
    expect(normalizePhone("00258841234567")).toBe("+258841234567");
    expect(normalizePhone("21 123 456")).toBeNull();
  });
});
