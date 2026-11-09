"use client";

import { useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { Badge, Button, Input, InputNumber, Modal, Segmented, Select } from "antd";
import {
  dealTypes,
  placeLabel,
  propertyTypes,
  roomOptions,
  type Dict,
  type ListingDisplay,
  type ListingFilters,
  type Locale,
} from "@mteam/shared";
import { LocationModal } from "./LocationModal";

type NumberField = "priceMin" | "priceMax" | "areaMin" | "areaMax" | "floorMin" | "floorMax";

const moreFields = { rooms: undefined, priceMin: undefined, priceMax: undefined, areaMin: undefined, areaMax: undefined, floorMin: undefined, floorMax: undefined };

export function SearchBar({ locale, t, filters, display }: { locale: Locale; t: Dict; filters: ListingFilters; display: ListingDisplay }) {
  const router = useRouter();
  const [searching, startSearch] = useTransition();
  const [draft, setDraft] = useState(filters);
  const [moreOpen, setMoreOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const change = (values: Partial<ListingFilters>) => setDraft({ ...draft, ...values });

  function run(filtersToSearch: ListingFilters) {
    // "deal" is always sent, even empty: it is how the home page knows a search was made.
    const params = new URLSearchParams({ deal: filtersToSearch.deal ?? "", cur: display.cur, view: display.view, sort: display.sort });
    for (const [key, value] of Object.entries(filtersToSearch)) {
      if (key !== "deal" && value !== undefined) params.set(key, value === true ? "1" : String(value));
    }
    setMoreOpen(false);
    setLocationOpen(false);
    startSearch(() => router.push(`?${params}`));
  }

  function search(event: SyntheticEvent) {
    event.preventDefault();
    run(draft);
  }

  function applyLocation(picked: Pick<ListingFilters, "city" | "district">) {
    const next = { ...draft, ...picked };
    setDraft(next);
    run(next);
  }

  const number = (name: NumberField, label: string) => (
    <label className="field">
      <small>{label}</small>
      <InputNumber
        value={draft[name]}
        min={0}
        precision={0}
        controls={false}
        inputMode="numeric"
        onChange={(value) => change({ [name]: value ?? undefined })}
        onPressEnter={search}
      />
    </label>
  );

  const place = draft.city && placeLabel(draft.city, locale) + (draft.district ? ` +${draft.district.length}` : "");
  const lastRoom = roomOptions[roomOptions.length - 1];
  const extraFilters = Object.keys(moreFields).filter((key) => draft[key as keyof typeof moreFields] !== undefined).length;

  return (
    <>
      {/* The focus ring is for keyboard users only. CSS cannot tell: Chrome counts a click on these fields as :focus-visible. */}
      <form
        className="search"
        role="search"
        noValidate
        onSubmit={search}
        onKeyUp={(event) => {
          if (event.key === "Tab") event.currentTarget.dataset.keyboard = "";
        }}
        onMouseDown={(event) => delete event.currentTarget.dataset.keyboard}
      >
        <label>
          <small>{t.search.deal}</small>
          <Select
            aria-label={t.search.deal}
            variant="borderless"
            allowClear
            suffix={null}
            popupMatchSelectWidth={false}
            placeholder={t.search.any}
            value={draft.deal}
            options={dealTypes.map((d) => ({ value: d, label: t.deal[d] }))}
            onChange={(deal) => change({ deal })}
          />
        </label>
        <label>
          <small>{t.search.type}</small>
          <Select
            aria-label={t.search.type}
            variant="borderless"
            allowClear
            suffix={null}
            popupMatchSelectWidth={false}
            placeholder={t.search.any}
            value={draft.type}
            options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))}
            onChange={(type) => change({ type })}
          />
        </label>
        <label className="grow">
          <small>{t.search.location}</small>
          <button type="button" className={place ? "location-trigger" : "location-trigger empty"} aria-label={place ? `${t.search.location}: ${place}` : t.search.location} onClick={() => setLocationOpen(true)}>
            {place || t.search.locationHint}
          </button>
        </label>
        <label>
          <small>{t.search.keyword}</small>
          <Input variant="borderless" allowClear aria-label={t.search.keyword} value={draft.q} onChange={(event) => change({ q: event.target.value || undefined })} />
        </label>
        <label className="chip">
          <input type="checkbox" checked={draft.verified ?? false} onChange={(event) => change({ verified: event.target.checked || undefined })} />
          {t.search.verifiedOnly}
        </label>
        <Badge count={extraFilters} color="var(--action)">
          <Button className="more-button" icon={<FilterOutlined />} onClick={() => setMoreOpen(true)}>
            {t.search.more}
          </Button>
        </Badge>
        <Button className="search-button" type="primary" htmlType="submit" icon={<SearchOutlined />} loading={searching}>
          {t.search.submit}
        </Button>
      </form>

      <Modal
        open={moreOpen}
        title={t.search.more}
        onCancel={() => setMoreOpen(false)}
        footer={[
          <Button key="clear" type="text" onClick={() => change(moreFields)}>
            {t.search.clear}
          </Button>,
          <Button key="search" type="primary" onClick={search}>
            {t.search.submit}
          </Button>,
        ]}
      >
        <div className="more-panel">
          <div className="field wide">
            <small>{t.search.rooms}</small>
            <Segmented<number>
              block
              aria-label={t.search.rooms}
              value={draft.rooms ?? 0}
              options={[{ value: 0, label: t.search.any }, ...roomOptions.map((r) => ({ value: r, label: r === lastRoom ? `${r}+` : String(r) }))]}
              onChange={(rooms) => change({ rooms: rooms || undefined })}
            />
          </div>
          {number("priceMin", t.search.priceMin)}
          {number("priceMax", t.search.priceMax)}
          {number("areaMin", t.search.areaMin)}
          {number("areaMax", t.search.areaMax)}
          {number("floorMin", t.search.floorMin)}
          {number("floorMax", t.search.floorMax)}
        </div>
      </Modal>

      <LocationModal open={locationOpen} locale={locale} t={t} initial={draft} onApply={applyLocation} onClose={() => setLocationOpen(false)} />
    </>
  );
}
