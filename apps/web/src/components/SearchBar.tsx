import {
  citySlugs,
  dealTypes,
  propertyTypes,
  roomOptions,
  type Dict,
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

export function SearchBar({ t, filters }: { t: Dict; filters: ListingFilters }) {
  const any = t.search.any;
  const lastRoom = roomOptions[roomOptions.length - 1];
  return (
    <form className="search" role="search" action="" method="get">
      <Select name="deal" label={t.search.deal} anyLabel={any} value={filters.deal} options={dealTypes.map((d) => ({ value: d, label: t.deal[d] }))} />
      <Select name="city" label={t.search.city} anyLabel={any} value={filters.city} options={citySlugs.map((c) => ({ value: c, label: t.city[c] }))} />
      <Select name="type" label={t.search.type} anyLabel={any} value={filters.type} options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))} />
      <PriceInput name="priceMin" label={t.search.priceMin} value={filters.priceMin} />
      <PriceInput name="priceMax" label={t.search.priceMax} value={filters.priceMax} />
      <Select name="rooms" label={t.search.rooms} anyLabel={any} value={filters.rooms} options={roomOptions.map((r) => ({ value: r, label: r === lastRoom ? `${r}+` : String(r) }))} />
      <button className="btn" type="submit">{t.search.submit}</button>
    </form>
  );
}
