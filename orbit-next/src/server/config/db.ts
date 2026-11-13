import "../utils/json-parse-patch";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@shared/schema";

type DatabaseClient = ReturnType<typeof postgres>;

const globalForDatabase = globalThis as typeof globalThis & {
  __orbitPostgresClient?: DatabaseClient;
};

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getClient(): DatabaseClient {
  if (globalForDatabase.__orbitPostgresClient) {
    return globalForDatabase.__orbitPostgresClient;
  }

  let raw = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";
  raw = raw.trim();

  try {
    const url = new URL(raw);
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    raw = url.toString();
  } catch {
    console.warn("[db] Could not parse DATABASE_URL for normalization");
  }

  const statementTimeoutMillis = parseInt(process.env.DB_POOL_STATEMENT_TIMEOUT_MS || "30000", 10);

  const client = postgres(raw, {
    prepare: false,
    max: 5,
    ssl: "require",
    connect_timeout: 10,
    idle_timeout: 20,
    connection: { statement_timeout: statementTimeoutMillis },
  });

  globalForDatabase.__orbitPostgresClient = client;
  return client;
}

export const pool = new Proxy({} as ReturnType<typeof postgres>, {
  get(_, prop) {
    return (getClient() as any)[prop];
  },
});

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    // During build time, return mock implementations that don't access the database
    if (process.env.npm_lifecycle_event === 'build' || process.env.NEXT_PHASE === 'phase-production-build') {
      // Return a mock drizzle instance with common methods
      return {
        select: () => ({
          from: () => ({
            where: () => ({ then: () => Promise.resolve([]) }),
            orderBy: () => ({ then: () => Promise.resolve([]) }),
            then: () => Promise.resolve([]),
          }),
          then: () => Promise.resolve([]),
        }),
        insert: () => ({
          values: () => ({
            returning: () => ({ then: () => Promise.resolve([]) }),
            onConflictDoUpdate: () => ({ returning: () => ({ then: () => Promise.resolve([]) }) }),
            then: () => Promise.resolve([]),
          }),
          then: () => Promise.resolve([]),
        }),
        update: () => ({
          set: () => ({
            where: () => ({ then: () => Promise.resolve({ rowCount: 0 }) }),
            then: () => Promise.resolve({ rowCount: 0 }),
          }),
          then: () => Promise.resolve({ rowCount: 0 }),
        }),
        delete: () => ({
          where: () => ({ then: () => Promise.resolve({ rowCount: 0 }) }),
          then: () => Promise.resolve({ rowCount: 0 }),
        }),
        transaction: (cb: any) => Promise.resolve(cb({
          select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
          insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
          update: () => ({ set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }) }),
          delete: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
        })),
      }[prop as string] || (() => Promise.resolve([]));
    }
    
    if (!_db) {
      _db = drizzle(getClient(), { schema, logger: false });
    }
    return (_db as any)[prop];
  },
});
