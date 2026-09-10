import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
export const dashboardSettings = pgTable("dashboard_settings", {
  id: text("id").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const alertActions = pgTable("alert_actions", {
  id: text("id").primaryKey(),
  state: text("state").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const commandHistory = pgTable("command_history", {
  id: text("id").primaryKey(),
  target: text("target").notNull(),
  command: text("command").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  mode: text("mode").notNull(),
  summary: jsonb("summary").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
