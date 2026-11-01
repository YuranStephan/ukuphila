import "server-only";
import { eq, inArray } from "drizzle-orm";
import { normalizeText } from "@/lib/interpret/numbers";
import type { Executor } from "../db/client";
import { kbChunks, kbDocuments } from "../db/schema";

/*
 * Retrieval over approved documents only (KB §45–47). The corpus is small, so BM25 in memory is enough, behaves the same
 * on PGlite and on hosted Postgres, and needs no embedding service.
 */

const STOP = new Set("a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que e ou se ao aos como mais meu minha eu tu ele ela nos sao ser ter esta este isso qual quais quando onde quem".split(" "));

function terms(text: string) {
  return normalizeText(text)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP.has(word));
}

export type RetrievedChunk = { documentId: string; title: string; section: string; content: string; score: number };

export async function searchKnowledge(db: Executor, query: string, limit = 4): Promise<RetrievedChunk[]> {
  const documents = await db.select({ id: kbDocuments.id, title: kbDocuments.title, keywords: kbDocuments.keywords }).from(kbDocuments).where(eq(kbDocuments.status, "approved"));
  if (documents.length === 0) return [];
  const chunks = await db.select().from(kbChunks).where(inArray(kbChunks.documentId, documents.map((document) => document.id)));
  const queryTerms = [...new Set(terms(query))];
  if (queryTerms.length === 0) return [];

  const titleOf = new Map(documents.map((document) => [document.id, document]));
  const tokenised = chunks.map((chunk) => {
    const document = titleOf.get(chunk.documentId);
    return { chunk, tokens: terms(`${document?.title ?? ""} ${(document?.keywords ?? []).join(" ")} ${chunk.section} ${chunk.content}`) };
  });
  const averageLength = tokenised.reduce((sum, row) => sum + row.tokens.length, 0) / (tokenised.length || 1);
  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) documentFrequency.set(term, tokenised.filter((row) => row.tokens.includes(term)).length);

  const K1 = 1.4;
  const B = 0.75;
  return tokenised
    .map(({ chunk, tokens }) => {
      let score = 0;
      for (const term of queryTerms) {
        const frequency = tokens.filter((token) => token === term).length;
        if (frequency === 0) continue;
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (tokenised.length - df + 0.5) / (df + 0.5));
        score += (idf * frequency * (K1 + 1)) / (frequency + K1 * (1 - B + (B * tokens.length) / averageLength));
      }
      return { documentId: chunk.documentId, title: titleOf.get(chunk.documentId)?.title ?? chunk.documentId, section: chunk.section, content: chunk.content, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
