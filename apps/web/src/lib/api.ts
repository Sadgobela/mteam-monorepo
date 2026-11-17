import { NextResponse } from "next/server";
import type { z } from "zod";

/** The app API's error shape: a short code the app turns into its own words. */
export const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** A JSON body checked against the schema, or null for anything else, a broken body included. */
export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | null> {
  try {
    const parsed = schema.safeParse(await request.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
