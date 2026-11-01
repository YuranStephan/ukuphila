import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { kbChunks, kbDocuments, markets, readinessItems } from "../db/schema";

/** What every installation needs, demo or real: markets, the knowledge base and the readiness checklist (KB §48). */

const MARKETS = [
  { slug: "xipamanine", name: "Xipamanine", district: "KaNhlamankulu", stage: "piloto" as const, lat: -25.9393, lng: 32.5617, blurb: "Mercado de referência para o primeiro piloto." },
  { slug: "zimpeto", name: "Zimpeto", district: "KaMubukwana", stage: "piloto" as const, lat: -25.8378, lng: 32.5656, blurb: "Grossistas e retalhistas na entrada norte da cidade." },
  { slug: "fajardo", name: "Fajardo", district: "KaMaxaquene", stage: "piloto" as const, lat: -25.9499, lng: 32.5807, blurb: "Hortícolas e frutas no centro da cidade." },
  { slug: "xiquelene", name: "Xiquelene", district: "KaMaxaquene", stage: "planeado" as const, lat: -25.9207, lng: 32.5917, blurb: "Próximo mercado, só depois de haver evidência." },
];

const KB_MAP: { id: string; title: string; domain: string; sections: number[]; authority: string; sensitivity: "public" | "internal"; keywords: string[]; status?: "draft" }[] = [
  { id: "UKP-001", title: "Visão Geral", domain: "PRODUCT", sections: [1, 2, 5, 23, 49], authority: "Product", sensitivity: "public", keywords: ["ukuphila", "visão", "princípios", "diferenciação"] },
  { id: "UKP-002", title: "Problema e Contexto", domain: "PRODUCT", sections: [3, 4, 6, 24], authority: "Product", sensitivity: "public", keywords: ["problema", "comerciante", "exclusão", "persona"] },
  { id: "UKP-003", title: "Produto", domain: "PRODUCT", sections: [7, 25, 26], authority: "Product", sensitivity: "internal", keywords: ["jornada", "mvp", "painéis"] },
  { id: "UKP-004", title: "Registo e Onboarding", domain: "OPERATIONS", sections: [8], authority: "Operations", sensitivity: "public", keywords: ["registo", "telefone", "dados mínimos"] },
  { id: "UKP-005", title: "KYC", domain: "KYC", sections: [9], authority: "Compliance", sensitivity: "internal", keywords: ["kyc", "níveis", "verificação", "agente"] },
  { id: "UKP-006", title: "Documentos", domain: "DOCUMENTS", sections: [10], authority: "Compliance", sensitivity: "internal", keywords: ["documento", "BI", "submissão", "revisão"] },
  { id: "UKP-007", title: "Gestão de Caixa", domain: "FINANCE", sections: [11], authority: "Product", sensitivity: "public", keywords: ["caixa", "venda", "despesa", "voz"] },
  { id: "UKP-008", title: "Carteira e Bolsos", domain: "FINANCE", sections: [12], authority: "Product", sensitivity: "public", keywords: ["bolsos", "negócio", "casa"] },
  { id: "UKP-009", title: "Poupança", domain: "FINANCE", sections: [13], authority: "Product", sensitivity: "public", keywords: ["poupança", "meta"] },
  { id: "UKP-010", title: "Xitique", domain: "XITIQUE", sections: [14], authority: "Product", sensitivity: "public", keywords: ["xitique", "grupo", "contribuição"] },
  { id: "UKP-011", title: "Crédito", domain: "CREDIT", sections: [15, 16], authority: "Product", sensitivity: "public", keywords: ["crédito", "fornecedor", "historial", "score"] },
  { id: "UKP-012", title: "Agentes", domain: "AGENTS", sections: [20, 21], authority: "Operations", sensitivity: "internal", keywords: ["agente", "quiosque", "leasing", "telefone"] },
  { id: "UKP-013", title: "WhatsApp", domain: "SUPPORT", sections: [17, 34], authority: "Product", sensitivity: "internal", keywords: ["whatsapp", "bot", "intenções"] },
  { id: "UKP-014", title: "Offline", domain: "TECH", sections: [19], authority: "Product", sensitivity: "public", keywords: ["offline", "sem internet", "sincronização"] },
  { id: "UKP-015", title: "Arquitectura", domain: "TECH", sections: [18, 27], authority: "Product", sensitivity: "internal", keywords: ["arquitectura", "dados"] },
  { id: "UKP-016", title: "Segurança", domain: "SECURITY", sections: [28, 29], authority: "Compliance", sensitivity: "internal", keywords: ["segurança", "auditoria", "regras"] },
  { id: "UKP-017", title: "Privacidade", domain: "PRIVACY", sections: [30], authority: "Compliance", sensitivity: "public", keywords: ["privacidade", "dados", "consentimento"] },
  { id: "UKP-018", title: "IA e Guardrails", domain: "AI_POLICY", sections: [31, 32, 33, 47], authority: "Product", sensitivity: "internal", keywords: ["ia", "guardrails", "verdade"] },
  { id: "UKP-019", title: "SOPs", domain: "OPERATIONS", sections: [36, 37, 38], authority: "Operations", sensitivity: "internal", keywords: ["sop", "procedimento", "rejeitado", "offline"] },
  { id: "UKP-020", title: "FAQs", domain: "SUPPORT", sections: [35], authority: "Product", sensitivity: "public", keywords: ["perguntas", "faq", "como funciona"] },
  { id: "UKP-021", title: "Métricas", domain: "OPERATIONS", sections: [39, 40], authority: "Operations", sensitivity: "internal", keywords: ["kpi", "piloto", "métricas"] },
  { id: "UKP-022", title: "Roadmap", domain: "PRODUCT", sections: [22, 41], authority: "Product", sensitivity: "internal", keywords: ["roadmap", "modelo de negócio", "receita"] },
  { id: "UKP-023", title: "Riscos", domain: "OPERATIONS", sections: [42], authority: "Operations", sensitivity: "internal", keywords: ["riscos", "mitigação"] },
  { id: "UKP-024", title: "Glossário", domain: "GLOSSARY", sections: [43], authority: "Product", sensitivity: "public", keywords: ["glossário", "termos"] },
  { id: "UKP-025", title: "Políticas e Compliance", domain: "COMPLIANCE", sections: [44, 48], authority: "Compliance", sensitivity: "internal", keywords: ["compliance", "perguntas em aberto", "prontidão"], status: "draft" },
];

function splitSections(markdown: string) {
  const sections = new Map<number, { title: string; body: string }>();
  for (const block of markdown.split(/^# (?=\d+\. )/m).slice(1)) {
    const newline = block.indexOf("\n");
    const heading = block.slice(0, newline).trim();
    const number = Number(heading.split(".")[0]);
    sections.set(number, { title: heading.replace(/^\d+\.\s*/, ""), body: block.slice(newline + 1).trim() });
  }
  return sections;
}

function chunkBody(body: string) {
  const parts: string[] = [];
  let current = "";
  for (const paragraph of body.split(/\n(?=##\s)|\n{2,}/)) {
    if (current.length + paragraph.length > 700 && current) {
      parts.push(current.trim());
      current = "";
    }
    current += `${paragraph}\n`;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export async function seedKnowledge(db: Executor) {
  const markdown = await readFile(path.join(process.cwd(), "docs", "source", "knowledge-base.md"), "utf8");
  const sections = splitSections(markdown);
  const today = new Date().toISOString().slice(0, 10);
  for (const document of KB_MAP) {
    const parts = document.sections.map((number) => sections.get(number)).filter((part): part is { title: string; body: string } => Boolean(part));
    const body = parts.map((part) => `## ${part.title}\n\n${part.body}`).join("\n\n");
    await db
      .insert(kbDocuments)
      .values({
        id: document.id,
        title: document.title,
        domain: document.domain,
        version: "1.0",
        status: document.status ?? "approved",
        source: "Project Knowledge Base",
        authority: document.authority,
        effectiveDate: today,
        sensitivity: document.sensitivity,
        entities: [],
        keywords: document.keywords,
        body,
      })
      .onConflictDoNothing();
    await db.delete(kbChunks).where(eq(kbChunks.documentId, document.id));
    const rows = parts.flatMap((part) => chunkBody(part.body).map((content) => ({ section: part.title, content })));
    if (rows.length) await db.insert(kbChunks).values(rows.map((row, ordinal) => ({ documentId: document.id, ordinal, ...row })));
  }
}

const READINESS = [
  ["Produto", "Produto definido"],
  ["Produto", "Fluxos de utilizador testados com comerciantes reais"],
  ["Regulação", "Entidade jurídica e licença ou parceiro licenciado definidos"],
  ["Regulação", "KYC validado com o regulador ou parceiro"],
  ["Regulação", "Gestão documental validada"],
  ["Finanças", "Modelo financeiro validado"],
  ["Segurança", "Segurança revista por terceiros"],
  ["Privacidade", "Privacidade revista e política publicada"],
  ["Operações", "Operações documentadas"],
  ["Operações", "Agentes treinados"],
  ["Tecnologia", "Modo offline testado em condições reais"],
  ["Tecnologia", "IA com guardrails avaliada em português e línguas locais"],
  ["Operações", "Métricas definidas"],
  ["Operações", "Piloto com critérios de sucesso e falha"],
  ["Operações", "Plano de incidentes"],
  ["Operações", "Plano de suporte"],
] as const;

export async function seedCore(db: Executor) {
  await db.insert(markets).values(MARKETS).onConflictDoNothing();
  await db
    .insert(readinessItems)
    .values(READINESS.map(([area, title], position) => ({ area, title, position, status: "por_iniciar" as const })))
    .onConflictDoNothing();
  await seedKnowledge(db);
}
