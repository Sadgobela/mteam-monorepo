"use client";

import { useState } from "react";
import { Button, Checkbox, Input, Modal } from "antd";
import { cities, cityAreas, cityDistricts, placeLabel, popularCities, type Dict, type Locale } from "@mteam/shared";

type Picked = { city?: string; district?: string[] };

function Body({ locale, t, initial, onApply }: { locale: Locale; t: Dict; initial: Picked; onApply: (picked: Picked) => void }) {
  const [city, setCity] = useState(initial.city);
  const [picked, setPicked] = useState(initial.district ?? []);
  const [text, setText] = useState("");

  const needle = text.trim().toLowerCase();
  const matches = (name: string) => `${name} ${placeLabel(name, locale)}`.toLowerCase().includes(needle);
  const others = cities.slice(popularCities.length);
  const cityShown = (name: string) => matches(name) || cityAreas(name).some((area) => area.districts.some(matches));
  // A city or group found by its own name shows everything in it, not only what also contains the typed text.
  const wholeCity = city !== undefined && matches(city);
  const shownIn = (area: { name: string; districts: string[] }) => (wholeCity || matches(area.name) ? area.districts : area.districts.filter(matches));
  const areas = city ? cityAreas(city).filter((area) => shownIn(area).length > 0) : [];
  const districtCount = city ? cityDistricts(city).length : 0;

  function choose(name: string) {
    if (name !== city) setPicked([]);
    setCity(name);
  }

  const toggle = (names: string[], on: boolean) => setPicked(on ? [...new Set([...picked, ...names])] : picked.filter((name) => !names.includes(name)));
  const box = (name: string) => (
    <Checkbox key={name} checked={picked.includes(name)} onChange={(event) => toggle([name], event.target.checked)}>
      {placeLabel(name, locale)}
    </Checkbox>
  );
  const cityButton = (name: string) => (
    <button key={name} type="button" className="loc-city" aria-pressed={name === city} onClick={() => choose(name)}>
      {placeLabel(name, locale)}
    </button>
  );

  return (
    <>
      <Input allowClear aria-label={t.search.locationFilter} placeholder={t.search.locationFilter} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="loc">
        <div className="loc-cities">
          <div className="loc-popular">{popularCities.filter(cityShown).map(cityButton)}</div>
          {others.filter(cityShown).map(cityButton)}
        </div>
        <div className="loc-areas">
          {!city && <p className="meta">{t.search.chooseCity}</p>}
          <div className="loc-columns">
          {areas.map((area) => {
            if (area.districts[0] === area.name) return box(area.name);
            const shown = shownIn(area);
            const on = shown.filter((name) => picked.includes(name)).length;
            return (
              <div key={area.name} className="loc-group" role="group" aria-label={placeLabel(area.name, locale)}>
                <Checkbox className="loc-head" checked={on === shown.length} indeterminate={on > 0 && on < shown.length} onChange={(event) => toggle(shown, event.target.checked)}>
                  {placeLabel(area.name, locale)}
                </Checkbox>
                {shown.map(box)}
              </div>
            );
          })}
          </div>
        </div>
      </div>
      <div className="loc-foot">
        <Button
          type="text"
          onClick={() => {
            setCity(undefined);
            setPicked([]);
          }}
        >
          {t.search.clear}
        </Button>
        <Button type="primary" onClick={() => onApply({ city, district: picked.length > 0 && picked.length < districtCount ? picked : undefined })}>
          {t.search.submit}
        </Button>
      </div>
    </>
  );
}

/** Choose a city, then any of its districts. Destroyed on close so that dismissing it forgets unapplied choices. */
export function LocationModal({ open, locale, t, initial, onApply, onClose }: { open: boolean; locale: Locale; t: Dict; initial: Picked; onApply: (picked: Picked) => void; onClose: () => void }) {
  return (
    <Modal open={open} title={t.search.locationTitle} width={860} footer={null} destroyOnHidden onCancel={onClose}>
      <Body locale={locale} t={t} initial={initial} onApply={onApply} />
    </Modal>
  );
}
