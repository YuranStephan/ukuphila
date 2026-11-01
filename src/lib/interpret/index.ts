import { findNumbers, normalizeText, type NumberToken } from "./numbers";

/*
 * The intent catalogue of KB §34, plus the records the app needs. This interpreter is deterministic, has no dependencies
 * and runs on the device, on the server and in tests. It only ever produces a proposal; the person confirms it.
 */

export type RecordIntent = "RECORD_SALE" | "RECORD_FIADO_SALE" | "RECORD_EXPENSE" | "RECORD_PURCHASE" | "TRANSFER_HOME" | "RECORD_SAVING" | "FIADO_REPAID";
export type QueryIntent = "CHECK_BALANCE" | "DAILY_SUMMARY" | "DOCUMENT_STATUS" | "KYC_HELP" | "XITIQUE_STATUS" | "SAVINGS_STATUS" | "CREDIT_INFO" | "STOCK_STATUS" | "FIADO_STATUS";
export type MetaIntent = "HUMAN_SUPPORT" | "GREETING" | "HELP" | "CONFIRM_YES" | "CONFIRM_NO" | "KNOWLEDGE" | "UNKNOWN";
export type Intent = RecordIntent | QueryIntent | MetaIntent;

export type Interpretation = {
  intent: Intent;
  confidence: number;
  amountCents?: number;
  quantity?: number;
  item?: string;
  person?: string;
  category?: string;
};

const has = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

const SALE = [/\bvendi\b/, /\bvendemos\b/, /\bvenda de\b/, /\bvendeu se\b/, /\bfiz uma venda\b/, /\brecebi de\b/];
const BUY = [/\bcomprei\b/, /\bcompramos\b/, /\babasteci\b/, /\breabasteci\b/, /\bcompra de\b/];
const EXPENSE = [/\bgastei\b/, /\bpaguei\b/, /\bdespesa\b/, /\bgasto\b/];
const HOME = [/\bpara casa\b/, /\bpra casa\b/, /\btirei .*casa\b/, /\blevei .*casa\b/, /\bretirei\b/];
const SAVE = [/\bpoupei\b/, /\bguardei\b/, /\bpus na poupanca\b/, /\bpoupar\b.*\b\d/];
const FIADO = [/\bfiado\b/, /\bfica a dever\b/, /\bficou a dever\b/, /\bvai pagar depois\b/, /\bpaga depois\b/, /\ba credito\b/];
const FIADO_REPAID = [/\bpagou\b.*\b(fiado|divida|deve|devia)\b/, /\b(me )?pagou\b/, /\bliquidou\b/];

const EXPENSE_CATEGORIES: [RegExp, string][] = [
  [/\b(chapa|transporte|boleia|txopela|taxi|carga)\b/, "transporte"],
  [/\b(taxa|mercado|licenca|senha)\b/, "taxa_mercado"],
  [/\b(saco|sacos|embalagem|plastico)\b/, "embalagem"],
  [/\b(credelec|luz|agua|energia)\b/, "credelec"],
  [/\b(recarga|credito de telefone|megas|dados|telefone)\b/, "comunicacao"],
  [/\b(ajudante|empregado|moco)\b/, "ajudante"],
];

const CONNECTORS = /^(por|a|de|em|com|no|na|ao|para|o|os|as|da|do|das|dos|um|uma|uns|umas|meticais|mt|cada)$/;

function pickAmount(tokens: NumberToken[], words: string[]) {
  if (tokens.length === 0) return null;
  const money = tokens.find((token) => /^(mt|meticais|metical)$/.test(words[token.index + token.length] ?? ""));
  if (money) return money;
  const after = tokens.find((token) => /^(por|a|custou|custa|foi)$/.test(words[token.index - 1] ?? ""));
  if (after) return after;
  return tokens.reduce((largest, token) => (token.value > largest.value ? token : largest), tokens[0]);
}

function extractItem(words: string[], tokens: NumberToken[], amount: NumberToken | null) {
  const quantity = tokens.find((token) => token !== amount);
  const start = quantity ? quantity.index + quantity.length : 1;
  const collected: string[] = [];
  for (let index = start; index < words.length; index += 1) {
    const word = words[index];
    if (amount && index === amount.index) break;
    if (/^(por|a|mt|meticais)$/.test(word) && collected.length > 0) break;
    if (CONNECTORS.test(word) && collected.length === 0) continue;
    collected.push(word);
    if (collected.length >= 3) break;
  }
  const item = collected.filter((word) => !CONNECTORS.test(word)).join(" ");
  return item || undefined;
}

function extractPerson(text: string) {
  const match =
    text.match(/\b(?:ao|a|o|a senhora|o senhor|a dona|dona|sr|sra|senhor|senhora|mana|mano|tia|tio)\s+([a-z]{3,}(?:\s[a-z]{3,})?)\s+(?:pagou|fica|ficou|vai|paga|deve|devia|liquidou)/) ??
    text.match(/\b(?:fiado|credito)\s+(?:ao|a|para o|para a|para)\s+(?:sr |sra |senhor |senhora |dona |mana |mano |tia |tio )?([a-z]{3,}(?:\s[a-z]{3,})?)/);
  return match?.[1] ? match[1].replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined;
}

export function interpret(input: string): Interpretation {
  const text = normalizeText(input);
  if (!text) return { intent: "UNKNOWN", confidence: 0 };

  if (/^(sim|s|confirmo|confirma|certo|isso|ok|esta certo|pode ser|yes)\b/.test(text) && text.split(" ").length <= 3) return { intent: "CONFIRM_YES", confidence: 0.98 };
  if (/^(nao|n|cancela|cancelar|errado|esta errado|no)\b/.test(text) && text.split(" ").length <= 3) return { intent: "CONFIRM_NO", confidence: 0.98 };

  const words = text.split(" ");
  const tokens = findNumbers(text);
  const amountToken = pickAmount(tokens, words);
  const money = amountToken ? { amountCents: Math.round(amountToken.value * 100) } : {};
  const quantityToken = tokens.find((token) => token !== amountToken);
  const quantity = quantityToken && Number.isInteger(quantityToken.value) ? { quantity: quantityToken.value } : {};
  const item = extractItem(words, tokens, amountToken);
  const confidence = amountToken ? 0.9 : 0.45;
  // "Quanto já poupei?" asks about the past; only statements can become records.
  const isQuestion = /^(quanto|quantos|quantas|como|qual|quais|quem|o que|onde|quando|porque|sera)\b/.test(text);

  if (!isQuestion) {
    if (has(text, FIADO_REPAID) && amountToken && !has(text, SALE)) {
      return { intent: "FIADO_REPAID", confidence: extractPerson(text) ? 0.88 : 0.66, ...money, person: extractPerson(text) };
    }
    if (has(text, SALE) && has(text, FIADO)) return { intent: "RECORD_FIADO_SALE", confidence: extractPerson(text) ? confidence : confidence - 0.15, ...money, ...quantity, item, person: extractPerson(text) };
    if (has(text, SALE)) return { intent: "RECORD_SALE", confidence, ...money, ...quantity, item };
    if (has(text, HOME)) return { intent: "TRANSFER_HOME", confidence, ...money };
    if (has(text, SAVE)) return { intent: "RECORD_SAVING", confidence, ...money };
    if (has(text, BUY)) return { intent: "RECORD_PURCHASE", confidence, ...money, ...quantity, item };
    if (has(text, EXPENSE)) {
      const category = EXPENSE_CATEGORIES.find(([pattern]) => pattern.test(text))?.[1] ?? "outro";
      return { intent: "RECORD_EXPENSE", confidence, ...money, category, item };
    }
  }

  if (has(text, [/\bfalar com\b/, /\bagente\b/, /\bpessoa\b/, /\bajuda humana\b/, /\batendente\b/, /\breclam/])) return { intent: "HUMAN_SUPPORT", confidence: 0.9 };
  if (has(text, [/\bdocumento/, /\bbi\b.*(aprovado|estado|passou)/, /\baprovad[oa]\b/])) return { intent: "DOCUMENT_STATUS", confidence: 0.86 };
  if (has(text, [/\bo que falta\b/, /\bkyc\b/, /\bverifica/, /\bnivel\b/])) return { intent: "KYC_HELP", confidence: 0.84 };
  if (has(text, [/\bxitique\b/, /\bchitique\b/, /\bgrupo\b/])) return { intent: "XITIQUE_STATUS", confidence: 0.88 };
  if (has(text, [/\bcredito\b/, /\bemprestimo\b/, /\bfornecedor\b/])) return { intent: "CREDIT_INFO", confidence: 0.82 };
  if (has(text, [/\bfiado\b/, /\bquem me deve\b/, /\bme devem?\b/, /\bdividas?\b/])) return { intent: "FIADO_STATUS", confidence: 0.86 };
  if (has(text, [/\bpoupanca\b/, /\bpoupei\b/, /\bmeta\b/])) return { intent: "SAVINGS_STATUS", confidence: 0.86 };
  if (has(text, [/\bstock\b/, /\bo que (esta a acabar|falta comprar)\b/, /\bprodutos?\b/])) return { intent: "STOCK_STATUS", confidence: 0.82 };
  if (has(text, [/\bcomo foi\b/, /\bhoje\b/, /\bvendas\b/, /\bresumo\b/, /\bquanto vendi\b/, /\bquanto ganhei\b/, /\blucro\b/])) return { intent: "DAILY_SUMMARY", confidence: 0.84 };
  if (has(text, [/\bsaldo\b/, /\bquanto tenho\b/, /\bdinheiro tenho\b/, /\bbolsos?\b/])) return { intent: "CHECK_BALANCE", confidence: 0.9 };
  if (has(text, [/^(ola|bom dia|boa tarde|boa noite|oi|hello|salama|xewani)\b/])) return { intent: "GREETING", confidence: 0.9 };
  if (has(text, [/\bajuda\b/, /\bmenu\b/, /\bo que (podes|sabes|consegues)\b/, /\bcomo funciona\b/])) return { intent: "HELP", confidence: 0.86 };
  if (text.endsWith("?") || has(text, [/^(o que|como|porque|por que|quando|onde|quem|posso|preciso|funciona)\b/])) return { intent: "KNOWLEDGE", confidence: 0.7 };

  // A bare amount: there is money here, but no way of telling what happened to it.
  if (amountToken) return { intent: "UNKNOWN", confidence: 0.3, ...money };
  return { intent: "UNKNOWN", confidence: 0.1 };
}

/** Wallet SMS forwarded to the app or to WhatsApp. Formats vary, so the result is always a proposal for the person to confirm. */
export function parseWalletSms(input: string): Interpretation | null {
  const text = normalizeText(input);
  if (!/\b(mpesa|m pesa|emola|e mola|mkesh|m kesh|confirmado|transacao|txn)\b/.test(text) && !/\bmt\b|\d(mt)\b/.test(text)) return null;
  const amount = input.match(/(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)\s?MT/i) ?? input.match(/MT\s?(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/i);
  if (!amount) return null;
  const raw = amount[1].replace(/\s/g, "");
  const decimals = raw.match(/[.,](\d{2})$/)?.[1];
  const whole = (decimals ? raw.slice(0, -3) : raw).replace(/[.,]/g, "");
  const amountCents = Number(whole) * 100 + Number(decimals ?? 0);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return null;
  const incoming = /\b(recebeu|recebeste|recebido|received|depositado|deposito)\b/.test(text);
  const outgoing = /\b(transferiu|transferiste|enviou|enviaste|pagou|pagaste|levantou|levantaste|sent|paid|compra)\b/.test(text);
  if (incoming === outgoing) return { intent: "UNKNOWN", confidence: 0.4, amountCents };
  return incoming ? { intent: "RECORD_SALE", confidence: 0.72, amountCents, item: "Recebido na carteira móvel" } : { intent: "RECORD_EXPENSE", confidence: 0.68, amountCents, category: "outro", item: "Pago pela carteira móvel" };
}
