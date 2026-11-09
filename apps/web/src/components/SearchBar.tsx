"use client";

import { useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { AutoComplete, Badge, Button, InputNumber, Modal, Segmented, Select } from "antd";
import {
  citySlugs,
  dealTypes,
  districtOptions,
  propertyTypes,
  roomOptions,
  type Dict,
  type ListingDisplay,
  type ListingFilters,
  type Locale,
} from "@mteam/shared";

type NumberField = "priceMin" | "priceMax" | "areaMin" | "areaMax" | "floorMin" | "floorMax";

const moreFields = { city: undefined, rooms: undefined, priceMin: undefined, priceMax: undefined, areaMin: undefined, areaMax: undefined, floorMin: undefined, floorMax: undefined };

export function SearchBar({ locale, t, filters, display }: { locale: Locale; t: Dict; filters: ListingFilters; display: ListingDisplay }) {
  const router = useRouter();
  const [searching, startSearch] = useTransition();
  const [draft, setDraft] = useState(filters);
  const [moreOpen, setMoreOpen] = useState(false);
  const change = (values: Partial<ListingFilters>) => setDraft({ ...draft, ...values });

  function search(event: SyntheticEvent) {
    event.preventDefault();
    // "deal" is always sent, even empty: it is how the home page knows a search was made.
    const params = new URLSearchParams({ deal: draft.deal ?? "", cur: display.cur, view: display.view, sort: display.sort });
    for (const [key, value] of Object.entries(draft)) {
      if (key !== "deal" && value !== undefined) params.set(key, value === true ? "1" : String(value));
    }
    setMoreOpen(false);
    startSearch(() => router.push(`?${params}`));
  }

  const number = (name: NumberField, label: string) => (
    <label className="field">
      <small>{label}</small>
      <InputNumber
        value={draft[name]}
        min={0}
        precision={0}
        inputMode="numeric"
        onChange={(value) => change({ [name]: value ?? undefined })}
        onPressEnter={search}
      />
    </label>
  );

  const needle = (draft.q ?? "").toLowerCase();
  const lastRoom = roomOptions[roomOptions.length - 1];
  const extraFilters = Object.keys(moreFields).filter((key) => draft[key as keyof typeof moreFields] !== undefined).length;

  return (
    <>
      <form className="search" role="search" noValidate onSubmit={search}>
        <label>
          <small>{t.search.deal}</small>
          <Select
            aria-label={t.search.deal}
            variant="borderless"
            allowClear
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
            placeholder={t.search.any}
            value={draft.type}
            options={propertyTypes.map((p) => ({ value: p, label: t.propertyType[p] }))}
            onChange={(type) => change({ type })}
          />
        </label>
        <label className="grow">
          <small>{t.search.location}</small>
          <AutoComplete
            aria-label={t.search.location}
            variant="borderless"
            allowClear
            placeholder={t.search.locationHint}
            value={draft.q}
            options={districtOptions(locale).filter((d) => `${d.label} ${d.value}`.toLowerCase().includes(needle))}
            onChange={(q: string | undefined) => change({ q: q || undefined })}
          />
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
            <small>{t.search.city}</small>
            <Segmented<string>
              block
              aria-label={t.search.city}
              value={draft.city ?? ""}
              options={[{ value: "", label: t.search.any }, ...citySlugs.map((c) => ({ value: c, label: t.city[c] }))]}
              onChange={(city) => change({ city: citySlugs.find((slug) => slug === city) })}
            />
          </div>
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
    </>
  );
}
