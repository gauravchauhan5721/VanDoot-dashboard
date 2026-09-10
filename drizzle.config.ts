import "dotenv/config";
import { defineConfig } from "drizzle-kit";
if (!process.env.DATABASE_URL)
  throw new Error(
    "DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.",
  );
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL },
});
