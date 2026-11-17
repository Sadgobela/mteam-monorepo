/**
 * The e2e database. Tests write to it freely (users, sessions, listings), so it must never be the one holding real local
 * data: anything but a database named mteam_e2e on this machine stops the run before a single query.
 */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://mteam:mteam@localhost:5432/mteam_e2e";

const url = new URL(E2E_DATABASE_URL);
if (url.pathname !== "/mteam_e2e" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error(`E2E_DATABASE_URL must point at the local mteam_e2e database, not ${url.hostname}${url.pathname}`);
}

// @mteam/db reads DATABASE_URL, in this process as in the app's.
process.env.DATABASE_URL = E2E_DATABASE_URL;

export const PORT = 3200;
export const BASE_URL = `http://localhost:${PORT}`;
