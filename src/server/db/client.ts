import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const databaseConnectionString =
  process.env.DATABASE_URL ??
  "postgresql://sheet_happens:sheet_happens@localhost:5432/sheet_happens?schema=public";

const adapter = new PrismaPg({ connectionString: databaseConnectionString });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
