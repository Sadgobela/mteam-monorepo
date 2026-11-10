import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listOpenLeads, listOpenReports, listPendingListings, listUnverifiedListings } from "@mteam/db";
import { formatDay, formatPrice, getDictionary, reportReasons, type Dict, type Listing } from "@mteam/shared";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Header } from "@/components/Header";
import { markLeadContactedAction, resolveReportAction, reviewListingAction, verifyListingAction } from "@/lib/admin-actions";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function reportLabel(reason: string, t: Dict): string {
  const known = reportReasons.find((item) => item === reason);
  return known ? t.listing.reportReasons[known] : reason;
}

function ListingSummary({ listing, t }: { listing: Listing; t: Dict }) {
  return (
    <div className="queue-item">
      <div className={`ph thumb ${listing.tone}`}>
        {listing.images[0] && <Image src={listing.images[0]} alt={listing.title} fill unoptimized />}
      </div>
      <div>
        <b>{listing.title}</b>
        <div className="meta">
          {formatPrice(listing.price, listing.currency)} · {listing.area} {t.units.sqm} · {[listing.address, listing.district].filter(Boolean).join(", ")} · {listing.contactPhone}
        </div>
        <p className="meta">{listing.description}</p>
      </div>
    </div>
  );
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  // A 404 rather than a redirect, so the panel's existence is not advertised.
  if (!user || user.role === "USER") notFound();
  const t = getDictionary(locale);
  const isAdmin = user.role === "ADMIN";
  const [pending, unverified, leads, reports] = await Promise.all([
    isAdmin ? listPendingListings() : [],
    listUnverifiedListings(),
    listOpenLeads(),
    isAdmin ? listOpenReports() : [],
  ]);

  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="page">
        <h1 className="heading">{t.admin.heading}</h1>

        {isAdmin && (
          <section className="queue">
            <h2>{t.admin.pending}</h2>
            {pending.length === 0 && <p className="meta">{t.admin.nothing}</p>}
            <ul className="mine">
              {pending.map((listing) => (
                <li key={listing.id}>
                  <ListingSummary listing={listing} t={t} />
                  <form action={reviewListingAction} className="queue-actions">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <button type="submit" name="decision" value="ACTIVE" className="btn">{t.admin.approve}</button>
                    <ConfirmSubmit label={t.admin.reject} question={t.admin.confirmReject} yes={t.confirm.yes} no={t.confirm.no} name="decision" value="REJECTED" />
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="queue">
          <h2>{t.admin.unverified}</h2>
          {unverified.length === 0 && <p className="meta">{t.admin.nothing}</p>}
          <ul className="mine">
            {unverified.map((listing) => (
              <li key={listing.id}>
                <ListingSummary listing={listing} t={t} />
                <form action={verifyListingAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <button type="submit" className="btn">{t.admin.verify}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
        <section className="queue">
          <h2>{t.admin.reports}</h2>
          {reports.length === 0 && <p className="meta">{t.admin.nothing}</p>}
          <ul className="mine">
            {reports.map((report) => (
              <li key={report.id}>
                <div>
                  <Link href={`/${locale}/listings/${report.listing.id}`}><b>{report.listing.title}</b></Link>
                  <div className="meta">{reportLabel(report.reason, t)} · {formatDay(report.createdAt.toISOString(), locale)}</div>
                  {report.note && <p className="meta">{report.note}</p>}
                </div>
                <form action={resolveReportAction}>
                  <input type="hidden" name="reportId" value={report.id} />
                  <button type="submit" className="btn ghost">{t.admin.resolve}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
        )}

        <section className="queue">
          <h2>{t.admin.leads}</h2>
          {leads.length === 0 && <p className="meta">{t.admin.nothing}</p>}
          <ul className="mine">
            {leads.map((lead) => (
              <li key={lead.id}>
                <div>
                  <b>{lead.name}</b>
                  <div className="meta">
                    <a href={`tel:${lead.phone}`}>{lead.phone}</a> · {t.deal[lead.deal === "SALE" ? "sale" : "rent"]} · {formatDay(lead.createdAt.toISOString(), locale)}
                  </div>
                </div>
                {lead.status === "NEW" ? (
                  <form action={markLeadContactedAction}>
                    <input type="hidden" name="leadId" value={lead.id} />
                    <button type="submit" className="btn ghost">{t.admin.contacted}</button>
                  </form>
                ) : (
                  <span className="status">{t.admin.contactedDone}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
