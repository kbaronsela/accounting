import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Auth.js — טבלת משתמש (שם טבלה: `user`) + שדות אפליקציה */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),
  locale: text("locale").default("he"),
  lastDocumentsSeenAt: timestamp("lastDocumentsSeenAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

/** תפקידים למשתמש — כמה שורות לכל משתמש (admin + accountant + client וכו׳) */
export const userRoles = pgTable(
  "user_role",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.role] }),
  }),
);

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => ({
    compoundPK: primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  }),
);

/** תיק לקוח אצל רואה חשבון */
export const clients = pgTable("clients", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  accountantId: text("accountantId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("displayName").notNull(),
  status: text("status").notNull().default("pending_invite"),
  invitedEmail: text("invitedEmail"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const clientMembers = pgTable(
  "client_member",
  {
    clientId: text("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memberRole: text("memberRole").notNull().default("member"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.clientId, t.userId] }),
  }),
);

export const invitations = pgTable("invitation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("tokenHash").notNull().unique(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  consumedAt: timestamp("consumedAt", { mode: "date" }),
  createdByUserId: text("createdByUserId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** שם תצוגה למוזמן (למשל רואה חשבון) — משמש בעת השלמת ההרשמה */
  inviteeDisplayName: text("inviteeDisplayName"),
  clientId: text("clientId").references(() => clients.id, {
    onDelete: "cascade",
  }),
  /** תפקיד ב-client_member אחרי קבלת ההזמנה (primary / member) */
  clientMemberRole: text("clientMemberRole"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const documents = pgTable("document", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("clientId")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  uploadedByUserId: text("uploadedByUserId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  storageObjectKey: text("storageObjectKey").notNull(),
  mimeType: text("mimeType").notNull(),
  byteSize: integer("byteSize").notNull(),
  status: text("status").notNull().default("draft_uploading"),
  qualityNotes: text("qualityNotes"),
  ocrProvider: text("ocrProvider"),
  ocrJobId: text("ocrJobId"),
  extracted: jsonb("extracted"),
  extractedAmount: text("extractedAmount"),
  extractedCurrency: text("extractedCurrency"),
  extractedDate: text("extractedDate"),
  extractedVendor: text("extractedVendor"),
  finalAmount: text("finalAmount"),
  finalCurrency: text("finalCurrency"),
  finalDate: text("finalDate"),
  finalVendor: text("finalVendor"),
  clientNote: text("clientNote"),
  submittedAt: timestamp("submittedAt", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  actorUserId: text("actorUserId").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  entityType: text("entityType").notNull(),
  entityId: text("entityId"),
  payloadJson: jsonb("payloadJson"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscription", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  authenticators: many(authenticators),
  clientMemberships: many(clientMembers),
  roles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  accountant: one(users, {
    fields: [clients.accountantId],
    references: [users.id],
  }),
  members: many(clientMembers),
  documents: many(documents),
}));

export const clientMembersRelations = relations(clientMembers, ({ one }) => ({
  client: one(clients, {
    fields: [clientMembers.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [clientMembers.userId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedByUserId],
    references: [users.id],
  }),
}));
