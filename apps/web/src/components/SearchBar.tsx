import {
  citySlugs,
  dealTypes,
  propertyTypes,
  roomOptions,
  type Dict,
  type ListingDisplay,
  type ListingFilters,
} from "@mteam/shared";

function Select({
  name,
  label,
  anyLabel,
  value,
  options,
}: {
  name: string;
  label: string;
  anyLabel: string;
  value: string | number | undefined;
  options: { value: string | number; label: string }[];
}) {
  return (
    <label>
      <small>{label}</small>
      <select name={name} defaultValue={value ?? ""}>
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PriceInput({ name, label, value }: { name: string; label: string; value: number | undefined }) {
  return (
    <label>
      <small>{label}</small>
      <input name={name} type="number" min={0} max={100000000} inputMode="numeric" defaultValue={value} />
    </label>
  );
}

export function SearchBar({ t, filters, display }: { t: Dict; filters: ListingFilters; display: ListingDisplay }) {
  const any = t.search.any;
  const lastRoom = roomOptions[roomOptions.length - 1];
  const moreIsActive = [filters.city, filters.priceMin, filters.priceMax, filters.rooms, filters.areaMin, filters.areaMax, filters.floorMin, filters.floorMax].some((v) => v !== undefined);
  return (
    <form className="search" role="search" action="" method="get" noValidate>
      <input type="hidden" name="cur" value={display.cur} />
      <input type="hidden" name="view" value={display.view} />
      <input type="hidden" name="sort" value={display.sort} />
      <Select name="deal" label={t.search.deal} anyLabel={any} value={filters.deal} options={dealTypes.map((d) => ({ value: d, label: t.deal[d] }))} />
      <Select name="type" label={t.search.type} anyLabel={any} value={filters.type} options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))} />
      <label className="grow">
        <small>{t.search.location}</small>
        <input name="q" defaultValue={filters.q} placeholder={t.search.locationHint} />
      </label>
      <label className="chip">
        <input type="checkbox" name="verified" value="1" defaultChecked={filters.verified} />
        {t.search.verifiedOnly}
      </label>
      <details className="more" open={moreIsActive}>
        <summary className="btn ghost">{t.search.more}</summary>
        <div className="more-panel">
          <Select name="city" label={t.search.city} anyLabel={any} value={filters.city} options={citySlugs.map((c) => ({ value: c, label: t.city[c] }))} />
          <PriceInput name="priceMin" label={t.search.priceMin} value={filters.priceMin} />
          <PriceInput name="priceMax" label={t.search.priceMax} value={filters.priceMax} />
          <PriceInput name="areaMin" label={t.search.areaMin} value={filters.areaMin} />
          <PriceInput name="areaMax" label={t.search.areaMax} value={filters.areaMax} />
          <PriceInput name="floorMin" label={t.search.floorMin} value={filters.floorMin} />
          <PriceInput name="floorMax" label={t.search.floorMax} value={filters.floorMax} />
          <Select name="rooms" label={t.search.rooms} anyLabel={any} value={filters.rooms} options={roomOptions.map((r) => ({ value: r, label: r === lastRoom ? `${r}+` : String(r) }))} />
        </div>
      </details>
      <button className="btn" type="submit">{t.search.submit}</button>
    </form>
  );
}
