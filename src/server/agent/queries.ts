import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { SessionUser } from "../auth/session";
import type { Executor } from "../db/client";
import { agentEarnings, businesses, deviceLeases, deviceModels, devices, documents, incidents, kycAttestations, kycProfiles, markets, users, visits } from "../db/schema";
import { DomainError } from "../errors";
import { assertAssigned, logAgentView } from "./service";

/** Keep list reads visible in the merchant's access history as well as dossier reads. */
export async function logAgentSubjects(db: Executor, user: SessionUser, merchantIds: string[], resource: string) {
  await Promise.all([...new Set(merchantIds)].map((merchantId) => logAgentView(db, user, merchantId, resource)));
}

/** Select only contact and business data; never load credentials or document storage metadata. */
export async function agentMerchantDetail(db: Executor, agentId: string, merchantId: string) {
  await assertAssigned(db, agentId, merchantId);
  const [profile] = await db.select({
    id: users.id, name: users.displayName, phone: users.phone, status: users.status,
    business: businesses, marketName: markets.name, level: kycProfiles.level, kycStatus: kycProfiles.status,
  }).from(businesses).innerJoin(users, eq(users.id, businesses.ownerId))
    .innerJoin(markets, eq(markets.id, businesses.marketId)).leftJoin(kycProfiles, eq(kycProfiles.userId, users.id))
    .where(and(eq(businesses.agentId, agentId), eq(businesses.ownerId, merchantId))).limit(1);
  if (!profile) return null;
  const [merchantDocuments, attestations] = await Promise.all([
    db.select({ id: documents.id, type: documents.type, status: documents.status, numberMasked: documents.numberMasked,
      version: documents.version, submittedAt: documents.submittedAt, rejectionReason: documents.rejectionReason, rejectionNote: documents.rejectionNote,
    }).from(documents).where(eq(documents.userId, merchantId)).orderBy(desc(documents.createdAt)),
    db.select({ id: kycAttestations.id, kind: kycAttestations.kind, source: kycAttestations.source,
      note: kycAttestations.note, createdAt: kycAttestations.createdAt,
    }).from(kycAttestations).where(eq(kycAttestations.userId, merchantId)).orderBy(desc(kycAttestations.createdAt)),
  ]);
  return { ...profile, level: profile.level ?? 0, documents: merchantDocuments, attestations };
}

export async function agentMerchantDevices(db: Executor, agentId: string, merchantId: string) {
  await assertAssigned(db, agentId, merchantId);
  const [phones, leases, models] = await Promise.all([
    db.select({ id: devices.id, label: devices.label, serial: devices.serial, status: devices.status,
      lastSyncAt: devices.lastSyncAt, modelName: deviceModels.name,
    }).from(devices).innerJoin(businesses, eq(businesses.ownerId, devices.userId))
      .leftJoin(deviceModels, eq(deviceModels.id, devices.modelId))
      .where(and(eq(devices.userId, merchantId), eq(businesses.agentId, agentId))).orderBy(desc(devices.createdAt)),
    db.select({ id: deviceLeases.id, code: deviceLeases.code, status: deviceLeases.status,
      instalmentCents: deviceLeases.instalmentCents, instalments: deviceLeases.instalments,
      frequency: deviceLeases.frequency, pendingTerms: deviceLeases.isExampleTerms,
    }).from(deviceLeases).innerJoin(businesses, eq(businesses.ownerId, deviceLeases.userId))
      .where(and(eq(deviceLeases.userId, merchantId), eq(businesses.agentId, agentId))).orderBy(desc(deviceLeases.startedAt)),
    db.select({ id: deviceModels.id, name: deviceModels.name, specs: deviceModels.specs })
      .from(deviceModels).where(eq(deviceModels.active, true)).orderBy(deviceModels.name),
  ]);
  return { phones, leases, models };
}

export async function assertAgentIncident(db: Executor, agentId: string, incidentId: string) {
  const [incident] = await db.select({ merchantId: incidents.subjectUserId }).from(incidents)
    .innerJoin(businesses, eq(businesses.ownerId, incidents.subjectUserId))
    .where(and(eq(incidents.id, incidentId), eq(businesses.agentId, agentId))).limit(1);
  if (!incident?.merchantId) throw new DomainError("sem_permissao", "Este incidente não pertence à tua carteira.");
  return incident.merchantId;
}

export async function agentEarningsByMonth(db: Executor, agentId: string) {
  const month = sql<string>`to_char(timezone('Africa/Maputo', ${agentEarnings.createdAt}), 'YYYY-MM')`;
  const rows = await db.select({ month, amountCents: sql<string>`sum(${agentEarnings.amountCents})`,
    count: sql<string>`count(*)`, pending: sql<string>`count(*) filter (where ${agentEarnings.isExampleRate})`,
  }).from(agentEarnings).where(eq(agentEarnings.agentId, agentId)).groupBy(month).orderBy(desc(month));
  return rows.map((row) => ({ month: row.month, amountCents: Number(row.amountCents), count: Number(row.count), pending: Number(row.pending) }));
}

export async function agentRecentVisits(db: Executor, agentId: string) {
  return db.select({ id: visits.id, at: visits.at, purpose: visits.purpose, outcome: visits.outcome, note: visits.note,
    merchantId: users.id, merchantName: users.displayName, businessName: businesses.name,
  }).from(visits).innerJoin(businesses, eq(businesses.id, visits.businessId)).innerJoin(users, eq(users.id, businesses.ownerId))
    .where(and(eq(visits.agentId, agentId), eq(businesses.agentId, agentId))).orderBy(desc(visits.at)).limit(20);
}
