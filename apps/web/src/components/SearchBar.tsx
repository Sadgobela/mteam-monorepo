"use client";

import { useState, useTransition, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { Badge, Button, Checkbox, Input, InputNumber, Modal, Popover, Segmented, Select } from "antd";
import {
  buildingStatuses,
  dealTypes,
  METRO_CITY,
  metroStations,
  placeLabel,
  propertyTypes,
  roomOptions,
  type Dict,
  type ListingDisplay,
  type ListingFilters,
  type Locale,
} from "@mteam/shared";
import { LocationModal } from "./LocationModal";

type NumberField = "priceMin" | "priceMax" | "areaMin" | "areaMax" | "floorMin" | "floorMax" | "sqmMin" | "sqmMax";

const moreFields = { rooms: undefined, priceMin: undefined, priceMax: undefined, areaMin: undefined, areaMax: undefined, floorMin: undefined, floorMax: undefined, sqmMin: undefined, sqmMax: undefined, building: undefined, metro: undefined, owner: undefined };

export function SearchBar({ locale, t, filters, display, results = false }: { locale: Locale; t: Dict; filters: ListingFilters; display: ListingDisplay; results?: boolean }) {
  const router = useRouter();
  const [searching, startSearch] = useTransition();
  const [draft, setDraft] = useState(filters);
  const [moreOpen, setMoreOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [openPill, setOpenPill] = useState<string | null>(null);
  const change = (values: Partial<ListingFilters>) => setDraft({ ...draft, ...values });

  function run(filtersToSearch: ListingFilters) {
    // "deal" is always sent, even empty: it is how the home page knows a search was made.
    const params = new URLSearchParams({ deal: filtersToSearch.deal ?? "", cur: display.cur, view: display.view, sort: display.sort });
    for (const [key, value] of Object.entries(filtersToSearch)) {
      if (key !== "deal" && value !== undefined) params.set(key, Array.isArray(value) ? value.join("|") : value === true ? "1" : String(value));
    }
    setMoreOpen(false);
    setLocationOpen(false);
    setOpenPill(null);
    startSearch(() => router.push(`?${params}`));
  }

  function search(event: SyntheticEvent) {
    event.preventDefault();
    run(draft);
  }

  function applyLocation(picked: Pick<ListingFilters, "city" | "district" | "street">) {
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

  const placeCount = (draft.district?.length ?? 0) + (draft.street?.length ?? 0);
  const place = draft.city && placeLabel(draft.city, locale) + (placeCount > 0 ? ` +${placeCount}` : "");
  const lastRoom = roomOptions[roomOptions.length - 1];
  const extraFilters = Object.keys(moreFields).filter((key) => draft[key as keyof typeof moreFields] !== undefined).length;

  const roomsSwitch = (
    <Segmented<number>
      block
      aria-label={t.search.rooms}
      value={draft.rooms ?? 0}
      options={[{ value: 0, label: t.search.any }, ...roomOptions.map((r) => ({ value: r, label: r === lastRoom ? `${r}+` : String(r) }))]}
      onChange={(rooms) => change({ rooms: rooms || undefined })}
    />
  );
  const statusBoxes = (
    <div className="field wide status-boxes">
      {buildingStatuses.map((status) => (
        <Checkbox
          key={status}
          checked={draft.building?.includes(status) ?? false}
          onChange={(event) => {
            const others = (draft.building ?? []).filter((item) => item !== status);
            const building = event.target.checked ? [...others, status] : others;
            change({ building: building.length > 0 ? building : undefined });
          }}
        >
          {t.search.building[status]}
        </Checkbox>
      ))}
    </div>
  );

  const pill = (key: string, label: string, active: boolean, content: ReactNode) => (
    <Popover
      key={key}
      trigger="click"
      placement="bottomLeft"
      open={openPill === key}
      onOpenChange={(open) => setOpenPill(open ? key : null)}
      content={
        <div className="pill-panel more-panel">
          {content}
          <Button className="wide" type="primary" onClick={search}>
            {t.search.submit}
          </Button>
        </div>
      }
    >
      <Button className={active ? "pill active" : "pill"}>{label}</Button>
    </Popover>
  );
  const anySet = (...values: unknown[]) => values.some((value) => value !== undefined);

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

      {results && (
        <div className="pills">
          {pill("price", t.search.price, anySet(draft.priceMin, draft.priceMax), <>{number("priceMin", t.search.priceMin)}{number("priceMax", t.search.priceMax)}</>)}
          {pill("area", t.search.area, anySet(draft.areaMin, draft.areaMax), <>{number("areaMin", t.search.areaMin)}{number("areaMax", t.search.areaMax)}</>)}
          {pill("rooms", t.search.rooms, anySet(draft.rooms), <div className="field wide">{roomsSwitch}</div>)}
          {pill("floor", t.search.floor, anySet(draft.floorMin, draft.floorMax), <>{number("floorMin", t.search.floorMin)}{number("floorMax", t.search.floorMax)}</>)}
          {pill("status", t.search.status, anySet(draft.building), statusBoxes)}
        </div>
      )}

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
            {roomsSwitch}
          </div>
          {number("priceMin", t.search.priceMin)}
          {number("priceMax", t.search.priceMax)}
          {number("areaMin", t.search.areaMin)}
          {number("areaMax", t.search.areaMax)}
          {number("floorMin", t.search.floorMin)}
          {number("floorMax", t.search.floorMax)}
          {number("sqmMin", t.search.sqmMin)}
          {number("sqmMax", t.search.sqmMax)}
          <div className="field wide">
            <small>{t.search.status}</small>
            {statusBoxes}
          </div>
          {(draft.city === undefined || draft.city === METRO_CITY) && (
            <label className="field wide">
              <small>{t.search.metro}</small>
              <Select
                aria-label={t.search.metro}
                allowClear
                showSearch
                placeholder={t.search.any}
                value={draft.metro}
                options={metroStations.map((name) => ({ value: name, label: placeLabel(name, locale) }))}
                onChange={(metro) => change({ metro })}
              />
            </label>
          )}
          <label className="chip-row wide">
            <Checkbox checked={draft.owner ?? false} onChange={(event) => change({ owner: event.target.checked || undefined })}>
              {t.search.ownerOnly}
            </Checkbox>
          </label>
        </div>
      </Modal>

      <LocationModal open={locationOpen} locale={locale} t={t} initial={draft} onApply={applyLocation} onClose={() => setLocationOpen(false)} />
    </>
  );
}
