import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button, Input } from "antd";
import { z } from "zod";
import { countMyListings, listMyListingsTab, myListingTabs, type MyListing, type MyListingTab } from "@mteam/db";
import { formatDay, formatPrice, getDictionary, sortOrders, type Dict, type Locale, type SortOrder } from "@mteam/shared";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EmptyState } from "@/components/EmptyState";
import { cardTitle } from "@/components/ListingCard";
import { Segmented } from "@/components/Segmented";
import { SubmitButton } from "@/components/SubmitButton";
import { archiveListingAction } from "@/lib/account-actions";
import { resolveLocale } from "@/lib/locale";
import { bumpListingAction, deleteDraftAction, renewListingAction } from "@/lib/my-listings-actions";
import { currentUser } from "@/lib/session";
import { loginPath } from "@/lib/login-path";
import type { Query } from "@/lib/url";
import "../../../my-listings.css";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  tab: z.enum(myListingTabs).optional().catch(undefined),
  q: z.string().trim().max(100).catch(""),
  sort: z.enum(sortOrders).catch("new"),
});

type View = { tab: MyListingTab; q: string; sort: SortOrder };

function viewHref(locale: Locale, { tab, q, sort }: View): string {
  const params = new URLSearchParams({ tab });
  if (q) params.set("q", q);
  if (sort !== "new") params.set("sort", sort);
  return `/${locale}/my-listings?${params}`;
}

/** The hidden fields every row action sends; the server checks the listing is the user's. `done` is the note shown after. */
function RowForm({ action, locale, id, t, done, children }: { action: (form: FormData) => Promise<unknown>; locale: Locale; id: number; t: Dict; done: string; children: ReactNode }) {
  return (
    <ActionForm action={action} done={done} failed={t.feedback.failed}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={id} />
      {children}
    </ActionForm>
  );
}

function Row({ mine, locale, t }: { mine: MyListing; locale: Locale; t: Dict }) {
  const { listing, status } = mine;
  const my = t.myListings;
  const count = (text: string, value: number) => text.replace("{count}", String(value));
  const nextBump =
    mine.nextBumpAt &&
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tbilisi" }).format(mine.nextBumpAt);
  const draft = status === "DRAFT";
  // A draft holds only what was filled in so far: a price of 0 or an empty address is left out rather than shown.
  const facts = [listing.price > 0 ? formatPrice(listing.price, listing.currency) : "", listing.address].filter(Boolean).join(" · ");
  return (
    <li>
      <div className="queue-item">
        <div className={`ph thumb ${listing.tone}`}>{listing.images[0] && <Image src={listing.images[0]} alt={listing.title} fill unoptimized />}</div>
        <div>
          <div className="my-row-title">
            <b>{listing.title || t.ui.draftTitle}</b>
            <span className="meta">{my.number.replace("{id}", String(listing.id))}</span>
          </div>
          {/* A draft is named by what it is so far, such as "For sale: apartment, Vake", as nobody has seen it yet. */}
          {draft && <div className="meta">{cardTitle(listing, locale, t)}</div>}
          {facts && <div className="meta">{facts}</div>}
          {!draft && (
            <div className="my-stats meta">
              <span>{count(my.views, mine.views)}</span>
              <span>{count(my.phoneReveals, mine.phoneReveals)}</span>
              <span>{count(my.favorites, mine.favorites)}</span>
              <span>{count(my.conversations, mine.conversations)}</span>
            </div>
          )}
          {listing.marketLevel && (
            <div className="meta">
              {t.market.heading}: {t.market.levels[listing.marketLevel - 1]}
            </div>
          )}
          {mine.expiresAt && <div className="meta">{my.expires.replace("{date}", formatDay(mine.expiresAt.toISOString(), locale))}</div>}
          {status === "ARCHIVED" && mine.canRenew && <div className="my-note">{my.expired}</div>}
          {nextBump && <div className="meta">{my.nextBump.replace("{time}", nextBump)}</div>}
        </div>
      </div>
      <span className="status" data-status={status}>
        {t.my.status[status]}
      </span>
      <div className="my-actions">
        {status === "ACTIVE" && (
          <Link href={`/${locale}/listings/${listing.id}`} className="btn ghost">
            {my.open}
          </Link>
        )}
        <Link href={`/${locale}/listings/${listing.id}/edit`} className="btn ghost">
          {my.edit}
        </Link>
        {mine.canBump && (
          <RowForm action={bumpListingAction} locale={locale} id={listing.id} t={t} done={t.feedback.bumped}>
            <SubmitButton className="btn ghost">{my.bump}</SubmitButton>
          </RowForm>
        )}
        {mine.canRenew && (
          <RowForm action={renewListingAction} locale={locale} id={listing.id} t={t} done={t.feedback.renewed}>
            <SubmitButton className="btn ghost">{my.renew}</SubmitButton>
          </RowForm>
        )}
        {(status === "ACTIVE" || status === "PENDING") && (
          <RowForm action={archiveListingAction} locale={locale} id={listing.id} t={t} done={t.feedback.archived}>
            <ConfirmSubmit label={t.my.archive} question={t.my.confirmArchive} yes={t.confirm.yes} no={t.confirm.no} />
          </RowForm>
        )}
        {draft && (
          <RowForm action={deleteDraftAction} locale={locale} id={listing.id} t={t} done={t.ui.draftDeleted}>
            <ConfirmSubmit label={t.ui.deleteDraft} question={t.ui.confirmDeleteDraft} yes={t.confirm.yes} no={t.confirm.no} />
          </RowForm>
        )}
      </div>
    </li>
  );
}

export default async function MyListingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/my-listings`));
  const t = getDictionary(locale);
  const my = t.myListings;
  const query = querySchema.parse(await searchParams);
  const counts = await countMyListings(user.id);
  // Without a chosen tab, open the first one with something in it, so a listing just sent for review is in view.
  const tab = query.tab ?? myListingTabs.find((name) => counts[name] > 0) ?? "active";
  const view: View = { tab, q: query.q, sort: query.sort };
  const rows = await listMyListingsTab(user.id, view);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0) - counts.expiring;
  const sortText: Record<SortOrder, string> = { new: t.results.sortNew, asc: t.results.sortAsc, desc: t.results.sortDesc };

  return (
    <main className="account-main narrow">
      <div className="row">
        <h1 className="heading">{t.my.heading}</h1>
        <span className="sp" />
        {user.role !== "USER" && (
          <Link href={`/${locale}/admin`} className="btn ghost">
            {t.admin.heading}
          </Link>
        )}
        <Link href={`/${locale}/listings/new`} className="btn">
          {t.nav.post}
        </Link>
      </div>
      {total === 0 ? (
        <EmptyState text={t.my.empty} />
      ) : (
        <>
          <div className="my-tabs">
            <Segmented
              label={my.tabsLabel}
              options={myListingTabs.map((name) => ({
                text: my.tab.replace("{name}", my.tabs[name]).replace("{count}", String(counts[name])),
                href: viewHref(locale, { ...view, tab: name }),
                active: name === tab,
              }))}
            />
          </div>
          <div className="my-tools">
            <form className="my-search" action={`/${locale}/my-listings`} role="search">
              <input type="hidden" name="tab" value={tab} />
              {view.sort !== "new" && <input type="hidden" name="sort" value={view.sort} />}
              <Input name="q" defaultValue={view.q} placeholder={my.search} aria-label={my.search} maxLength={100} allowClear />
              {/* The word is the name; a phone shows only the icon, so the field and button fit one line. */}
              {/* Drawn here: Ant's icon package cannot render in a server component. */}
              <Button
                htmlType="submit"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                }
              >
                <span className="my-search-word">{my.searchButton}</span>
              </Button>
            </form>
            <Segmented
              label={my.sortLabel}
              options={sortOrders.map((sort) => ({ text: sortText[sort], href: viewHref(locale, { ...view, sort }), active: sort === view.sort }))}
            />
          </div>
          {rows.length === 0 && <EmptyState text={my.emptyTab} />}
          <ul className="mine">
            {rows.map((mine) => (
              <Row key={mine.listing.id} mine={mine} locale={locale} t={t} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
