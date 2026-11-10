import { featureGroups, featureLabel, groupNames, groupTitles, specLabel, specNames, specTitles, type Dict, type Listing, type Locale } from "@mteam/shared";

/** Everything a listing states beyond the headline facts. Nothing is shown for what was left blank. */
export function ListingDetails({ listing, locale, t }: { listing: Listing; locale: Locale; t: Dict }) {
  const f = t.post.fields;
  const numbers: [string, number | undefined][] = [
    [f.bedrooms, listing.bedrooms],
    [f.ceiling, listing.ceiling],
    [f.yearBuilt, listing.yearBuilt],
  ];
  const rows = [
    ...numbers.flatMap(([title, value]) => (value === undefined ? [] : [[title, String(value)]])),
    ...specNames.flatMap((name) => {
      const value = listing.specs[name];
      return value ? [[specTitles[name][locale], specLabel(name, value, locale)]] : [];
    }),
  ];
  const groups = groupNames.flatMap((group) => {
    const present = Object.keys(featureGroups[group]).filter((key) => listing.features.includes(key));
    return present.length > 0 ? [{ group, present }] : [];
  });
  if (rows.length === 0 && groups.length === 0) return null;

  return (
    <section className="ldetails">
      <h2>{f.moreDetails}</h2>
      {rows.length > 0 && (
        <dl className="spec-grid">
          {rows.map(([title, value]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {groups.map(({ group, present }) => (
        <div key={group} className="feature-group">
          <h3>{groupTitles[group][locale]}</h3>
          <ul>
            {present.map((key) => (
              <li key={key}>{featureLabel(key, locale)}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
