import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton: hot reload re-evaluates this module
// on every edit, which would otherwise open a new SQLite/Postgres connection
// each time and exhaust the connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
