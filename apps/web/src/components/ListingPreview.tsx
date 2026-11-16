import { draftQuality, formatPrice, placeLabel, priceUnit, QUALITY_TARGETS, type DealType, type Dict, type Locale } from "@mteam/shared";
import { Thumbnail } from "./Thumbnail";

/** The listing as a card, from the form's values while they are typed. */
export function ListingPreview({ values, photo, locale, t }: { values: Record<string, string>; photo?: string; locale: Locale; t: Dict }) {
  const price = Number(values.price);
  const unit = priceUnit(values.deal as DealType, t);
  const place = [values.district, values.city].filter(Boolean).map((name) => placeLabel(name, locale));
  return (
    <section className="post-preview" aria-label={t.post.preview}>
      <h2>{t.post.preview}</h2>
      <div className="card">
        <div className="ph">{photo && <Thumbnail src={photo} alt="" />}</div>
        <div className="cbody">
          <span className="price">
            {price > 0 ? formatPrice(price, values.currency === "GEL" ? "GEL" : "USD") : "—"}
            {unit && <small className="meta"> {unit}</small>}
          </span>
          <b className="ctitle">{values.title || "—"}</b>
          <div className="cfacts">
            {place.length > 0 && <span>{place.join(", ")}</span>}
            {values.area && (
              <span>
                {values.area} {t.units.sqm}
              </span>
            )}
            {values.rooms && (
              <span>
                {values.rooms} {t.units.rooms}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** How complete the listing is, with what to add next. */
export function QualityMeter({ values, photos, t }: { values: Record<string, string>; photos: number; t: Dict }) {
  const { score, tips } = draftQuality(values, photos);
  const q = t.post.quality;
  return (
    <section className="post-quality" aria-label={q.heading}>
      <h2>
        {q.heading}: {score}%
      </h2>
      <meter min={0} max={100} low={50} high={80} optimum={100} value={score} aria-label={q.heading} />
      {tips.length === 0 ? (
        <p className="meta">{q.done}</p>
      ) : (
        <ul>
          {tips.map((tip) => (
            <li key={tip}>{q.tips[tip].replace("{count}", String(QUALITY_TARGETS[tip]))}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
