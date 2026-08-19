import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const clients = new Map<string, postgres.Sql>();

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  let client = clients.get(connectionString);
  if (!client) {
    client = postgres(connectionString, {
      max: process.env.NODE_ENV === "production" ? 10 : 3,
      prepare: false,
      transform: { undefined: null }
    });
    clients.set(connectionString, client);
  }
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;

export async function closeDatabase(): Promise<void> {
  await Promise.all([...clients.values()].map((client) => client.end()));
  clients.clear();
}
