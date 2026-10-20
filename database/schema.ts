import { eq, gt, or } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { AuditDetail, AuditEvent } from "#shared/events";
import type { JobData, JobResult } from "#shared/jobs";
import type { SiteService } from "#shared/types";

export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const jobOperation = pgEnum("job_operation", ["add", "remove"]);
export const itemStatus = pgEnum("item_status", [
  "pending",
  "succeeded",
  "failed",
]);
export const auditOutcome = pgEnum("audit_outcome", [
  "pending",
  "succeeded",
  "failed",
  "unknown",
]);

export const siteSettings = pgTable(
  "site_settings",
  {
    id: boolean("id").primaryKey().default(true),
    supportUrl: text("support_url").notNull(),
    services: jsonb("services").$type<SiteService[]>().notNull(),
  },
  (table) => [
    check("site_settings_singleton", eq(table.id, true).inlineParams()),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    subject: text("subject").notNull(),
    oidcSid: text("oidc_sid"),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email"),
    encryptedTokens: text("encrypted_tokens").notNull(),
    refreshAt: timestamp("refresh_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("session_subject").on(table.subject),
    index("session_oidc_sid").on(table.oidcSid),
    index("session_expiry").on(table.expiresAt),
  ],
);

export const logoutTokens = pgTable(
  "logout_tokens",
  {
    jti: text("jti").primaryKey(),
    subject: text("subject"),
    oidcSid: text("oidc_sid"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("logout_subject").on(table.subject),
    index("logout_sid").on(table.oidcSid),
    index("logout_expiry").on(table.expiresAt),
  ],
);

export const managedGroups = pgTable(
  "managed_groups",
  {
    groupId: text("group_id").primaryKey(),
    label: text("label").notNull(),
    note: text("note").notNull().default(""),
    enrolled: boolean("enrolled").notNull().default(true),
    allowInvites: boolean("allow_invites").notNull().default(false),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "managed_group_invites_require_enrollment",
      or(
        eq(table.enrolled, true),
        eq(table.allowInvites, false),
      )!.inlineParams(),
    ),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey(),
    token: text("token").notNull().unique(),
    allowRegistration: boolean("allow_registration").notNull().default(false),
    note: text("note").notNull().default(""),
    groupId: text("group_id")
      .notNull()
      .references(() => managedGroups.groupId),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("invitation_group").on(table.groupId, table.createdAt.desc()),
    check("invitation_expiry", gt(table.expiresAt, table.createdAt)),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey(),
    queueId: uuid("queue_id").notNull(),
    actorSubject: text("actor_subject").notNull(),
    groupId: text("group_id").notNull(),
    data: jsonb("data").$type<JobData>().notNull(),
    results: jsonb("results").$type<JobResult[]>().notNull().default([]),
    status: jobStatus("status").notNull().default("queued"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("job_actor").on(table.actorSubject, table.createdAt.desc()),
  ],
);

export const jobItems = pgTable(
  "job_items",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    operation: jobOperation("operation").notNull(),
    status: itemStatus("status").notNull().default("pending"),
    error: text("error"),
  },
  (table) => [
    primaryKey({ columns: [table.jobId, table.itemKey, table.operation] }),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    actorSubject: text("actor_subject").notNull(),
    operation: text("operation").notNull(),
    groupId: text("group_id"),
    target: jsonb("target").$type<{ type: string; id: string }>(),
    jobId: uuid("job_id").references(() => jobs.id),
    outcome: auditOutcome("outcome").notNull(),
    detail: jsonb("detail").$type<AuditDetail>().notNull().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("audit_created").on(table.createdAt.desc()),
    index("audit_group").on(table.groupId, table.createdAt.desc()),
  ],
);

export type AuditRecord = typeof auditEvents.$inferInsert & AuditEvent;
