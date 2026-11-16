import { notFound } from "next/navigation";
import { listCurrentBrokers, listInviteBranches, listInvites, type InviteRow } from "@mteam/db";
import { formatDay, getDictionary, type Dict, type Locale } from "@mteam/shared";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Header } from "@/components/Header";
import { removeBrokerAction, revokeInviteAction } from "@/lib/invite-actions";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";
import { InviteCreator } from "./InviteCreator";
import "@/app/brokers.css";

export const dynamic = "force-dynamic";

function inviteDetail(invite: InviteRow, locale: Locale, t: Dict): string {
  if (invite.status === "open") return t.brokersAdmin.validUntil.replace("{date}", formatDay(invite.expiresAt.toISOString(), locale));
  if (invite.status === "used") return t.brokersAdmin.usedBy.replace("{name}", invite.usedBy ?? t.brokersAdmin.noName);
  return formatDay(invite.expiresAt.toISOString(), locale);
}

/** Admins invite brokers here and take the role back. */
export default async function AdminBrokersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  // A 404 rather than a redirect, like the rest of the admin panel.
  if (user?.role !== "ADMIN") notFound();
  const t = getDictionary(locale);
  const copy = t.brokersAdmin;
  const [branches, invites, brokers] = await Promise.all([listInviteBranches(), listInvites(), listCurrentBrokers()]);

  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="page">
        <h1 className="heading">{copy.heading}</h1>

        <section className="queue">
          <h2>{copy.inviteHeading}</h2>
          <p className="meta">{copy.inviteLead}</p>
          <InviteCreator locale={locale} t={t} branches={branches} />
        </section>

        <section className="queue">
          <h2>{copy.invites}</h2>
          {invites.length === 0 && <p className="meta">{t.admin.nothing}</p>}
          <ul className="mine">
            {invites.map((invite) => (
              <li key={invite.id}>
                <div>
                  <b>{copy.status[invite.status]}</b>
                  <div className="meta">
                    {[formatDay(invite.createdAt.toISOString(), locale), invite.branch, inviteDetail(invite, locale, t)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {invite.status === "open" && (
                  <ActionForm action={revokeInviteAction} failed={t.feedback.failed}>
                    <input type="hidden" name="id" value={invite.id} />
                    <ConfirmSubmit label={copy.revoke} question={copy.confirmRevoke} yes={t.confirm.yes} no={t.confirm.no} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="queue">
          <h2>{copy.brokers}</h2>
          {brokers.length === 0 && <p className="meta">{t.admin.nothing}</p>}
          <ul className="mine">
            {brokers.map((broker) => (
              <li key={broker.userId}>
                <div>
                  <b>{broker.name || copy.noName}</b>
                  <div className="meta">{[broker.phone, broker.branch || copy.noBranch].filter(Boolean).join(" · ")}</div>
                </div>
                <ActionForm action={removeBrokerAction} failed={t.feedback.failed}>
                  <input type="hidden" name="userId" value={broker.userId} />
                  <ConfirmSubmit label={copy.remove} question={copy.confirmRemove} yes={t.confirm.yes} no={t.confirm.no} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
