"use client";

import { useState } from "react";
import { Button, Checkbox, Input, Modal } from "antd";
import { cities, cityAreas, placeLabel, popularCities, type Dict, type Locale } from "@mteam/shared";

type Picked = { city?: string; district?: string[] };

function Body({ locale, t, initial, onApply }: { locale: Locale; t: Dict; initial: Picked; onApply: (picked: Picked) => void }) {
  const [city, setCity] = useState(initial.city);
  const [picked, setPicked] = useState(initial.district ?? []);
  const [text, setText] = useState("");

  const needle = text.trim().toLowerCase();
  const matches = (name: string) => `${name} ${placeLabel(name, locale)}`.toLowerCase().includes(needle);
  const others = cities.slice(popularCities.length);
  const cityShown = (name: string) => matches(name) || cityAreas(name).some((area) => area.districts.some(matches));
  const areas = city ? cityAreas(city).filter((area) => matches(area.name) || area.districts.some(matches)) : [];

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
            const on = area.districts.filter((name) => picked.includes(name)).length;
            return (
              <div key={area.name} className="loc-group">
                <Checkbox className="loc-head" checked={on === area.districts.length} indeterminate={on > 0 && on < area.districts.length} onChange={(event) => toggle(area.districts, event.target.checked)}>
                  {placeLabel(area.name, locale)}
                </Checkbox>
                {area.districts.filter(matches).map(box)}
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
        <Button type="primary" onClick={() => onApply({ city, district: picked.length > 0 ? picked : undefined })}>
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
