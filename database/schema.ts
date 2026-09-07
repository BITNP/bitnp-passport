import { eq, gt, relations } from "drizzle-orm";
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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const termStatus = pgEnum("term_status", [
  "draft",
  "current",
  "archived",
]);
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

export const portalAdmins = pgTable("portal_admins", {
  subject: text("subject").primaryKey(),
  grantedBy: text("granted_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
    }).notNull(),
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

export const managedGroups = pgTable("managed_groups", {
  groupId: text("group_id").primaryKey(),
  label: text("label").notNull(),
  note: text("note").notNull().default(""),
  allowInvites: boolean("allow_invites").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const groupDelegations = pgTable(
  "group_delegations",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => managedGroups.groupId, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    grantedBy: text("granted_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.subject] }),
    index("delegation_subject").on(table.subject),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
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

export const terms = pgTable(
  "terms",
  {
    id: uuid("id").primaryKey(),
    label: text("label").notNull().unique(),
    status: termStatus("status").notNull().default("draft"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("one_current_term")
      .on(table.status)
      .where(eq(table.status, "current").inlineParams()),
  ],
);

export const termGroups = pgTable(
  "term_groups",
  {
    termId: uuid("term_id")
      .notNull()
      .references(() => terms.id),
    groupId: text("group_id")
      .notNull()
      .unique()
      .references(() => managedGroups.groupId),
  },
  (table) => [primaryKey({ columns: [table.termId, table.groupId] })],
);

export const termRelations = relations(terms, ({ many }) => ({
  groups: many(termGroups),
}));

export const termGroupRelations = relations(termGroups, ({ one }) => ({
  term: one(terms, {
    fields: [termGroups.termId],
    references: [terms.id],
  }),
}));

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey(),
    queueId: uuid("queue_id").notNull(),
    actorSubject: text("actor_subject").notNull(),
    groupId: text("group_id")
      .notNull()
      .references(() => managedGroups.groupId),
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
    target: text("target"),
    jobId: uuid("job_id").references(() => jobs.id),
    outcome: auditOutcome("outcome").notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
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
