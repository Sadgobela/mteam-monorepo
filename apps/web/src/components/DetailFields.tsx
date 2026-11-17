"use client";

import { useState } from "react";
import { Checkbox } from "antd";
import { featureLabel, groupKeys, groupNames, groupTitles, specKeys, specLabel, specNames, specTitles, type Dict, type Locale } from "@mteam/shared";
import { FormSelect } from "./FormSelect";

/** The optional details on the posting form. They post as ordinary fields, with the ticked features joined into one. `values` fills them in when editing. */
export function DetailFields({ locale, t, showsRooms, values = {}, onChange }: { locale: Locale; t: Dict; showsRooms: boolean; values?: Record<string, string>; onChange?: () => void }) {
  const f = t.post.fields;
  const [features, setFeatures] = useState<string[]>(() => (values.features ? values.features.split("|") : []));
  // No browser limits: a field in the closed section could not show its message and would silently block Next. The draft check reports it instead.
  const number = (name: string, label: string) => (
    <label className="field short">
      <small>{label}</small>
      <input name={name} type="number" step="any" defaultValue={values[name]} />
    </label>
  );
  return (
    <div className="detail-fields">
      <div className="post-grid">
        {showsRooms && number("bedrooms", f.bedrooms)}
        {number("ceiling", f.ceiling)}
        {number("yearBuilt", f.yearBuilt)}
      </div>
      <div className="post-grid">
        {specNames.map((name) => (
          <FormSelect key={name} name={name} optional initial={values[name]} onChange={onChange} label={specTitles[name][locale]} options={specKeys(name).map((key) => ({ value: key, label: specLabel(name, key, locale) }))} />
        ))}
      </div>
      {groupNames.map((group) => (
        <fieldset key={group} className="feature-group">
          <legend>{groupTitles[group][locale]}</legend>
          {groupKeys(group).map((key) => (
            <Checkbox key={key} checked={features.includes(key)} onChange={(event) => {
                setFeatures(event.target.checked ? [...features, key] : features.filter((item) => item !== key));
                onChange?.();
              }}>
              {featureLabel(key, locale)}
            </Checkbox>
          ))}
        </fieldset>
      ))}
      <input type="hidden" name="features" value={features.join("|")} />
    </div>
  );
}
