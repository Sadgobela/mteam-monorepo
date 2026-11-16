import { z } from "zod";

const emailEnvSchema = z.object({ EMAIL_PROVIDER: z.enum(["log"]).optional() });

export interface Email {
  to: string;
  subject: string;
  link: string;
}

/** Throws when no email can go out: in production EMAIL_PROVIDER must be chosen. Checked before anything is created. */
export function assertCanSendEmail(): void {
  const { EMAIL_PROVIDER } = emailEnvSchema.parse(process.env);
  if (!EMAIL_PROVIDER && process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER is not set");
}

/**
 * Sends a link by email. `log` writes it to the server log instead, like SMS_PROVIDER=log, for the private preview
 * where only the team reads the log. Locally it may be left unset; in production it must be chosen.
 * ponytail: a real email provider goes here before the site opens to the public.
 */
export function sendEmail({ to, subject, link }: Email): void {
  assertCanSendEmail();
  console.info(`[email] ${to}: ${subject} ${link}`);
}
