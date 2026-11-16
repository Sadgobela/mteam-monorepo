import type { ReactNode } from "react";
import Link from "next/link";
import { checkInvite, claimInviteCheck } from "@mteam/db";
import { getDictionary, type Dict, type Locale } from "@mteam/shared";
import { Header } from "@/components/Header";
import { SubmitButton } from "@/components/SubmitButton";
import { acceptInviteAction } from "@/lib/invite-actions";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { clientIp, currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type User = Awaited<ReturnType<typeof currentUser>>;

/** What the visitor can do with the link: sign in, accept, or read why not. The link is checked only for a signed-in user. */
async function InviteBody({ user, token, locale, t }: { user: User; token: string; locale: Locale; t: Dict }): Promise<ReactNode> {
  const copy = t.brokersAdmin;
  if (!user) {
    return (
      <>
        <p className="meta">{copy.signInFirst}</p>
        <Link className="btn" href={loginPath(locale, `/${locale}/invite/${encodeURIComponent(token)}`)}>{copy.signIn}</Link>
      </>
    );
  }
  if (user.role !== "USER") return <p className="note">{copy.already}</p>;
  if (!(await claimInviteCheck(await clientIp()))) return <p className="note" role="alert">{copy.tooMany}</p>;
  const invite = await checkInvite(token);
  if (invite.status !== "open") return <p className="note" role="alert">{copy[invite.status]}</p>;
  return (
    <>
      <p>{copy.explain}</p>
      {invite.branch && <p className="meta">{copy.inviteBranch.replace("{name}", invite.branch)}</p>}
      <form action={acceptInviteAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <SubmitButton>{copy.accept}</SubmitButton>
      </form>
    </>
  );
}

/** An invite link from an admin. Accepting it makes the signed-in user an MTeam broker. */
export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: raw, token } = await params;
  const locale = resolveLocale(raw);
  const t = getDictionary(locale);
  const user = await currentUser();
  return (
    <>
      <Header locale={locale} t={t} signedIn={user !== null} />
      <main className="section narrow">
        <h1>{t.brokersAdmin.inviteTitle}</h1>
        {await InviteBody({ user, token, locale, t })}
      </main>
    </>
  );
}
