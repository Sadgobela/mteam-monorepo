"use client";

import { useState } from "react";
import { Checkbox } from "antd";
import { featureLabel, groupKeys, groupNames, groupTitles, specKeys, specLabel, specNames, specTitles, type Dict, type Locale } from "@mteam/shared";
import { FormSelect } from "./FormSelect";

/** The optional details on the posting form. They post as ordinary fields, with the ticked features joined into one. */
export function DetailFields({ locale, t, showsRooms }: { locale: Locale; t: Dict; showsRooms: boolean }) {
  const f = t.post.fields;
  const [features, setFeatures] = useState<string[]>([]);
  const number = (name: string, label: string, min: number, max: number, step = 1) => (
    <label className="field">
      <small>{label}</small>
      <input name={name} type="number" min={min} max={max} step={step} />
    </label>
  );
  return (
    <div className="detail-fields">
      <div className="form-row">
        {showsRooms && number("bedrooms", f.bedrooms, 1, 50)}
        {number("ceiling", f.ceiling, 1, 20, 0.01)}
        {number("yearBuilt", f.yearBuilt, 1800, 2100)}
      </div>
      <div className="form-row">
        {specNames.map((name) => (
          <FormSelect key={name} name={name} optional label={specTitles[name][locale]} options={specKeys(name).map((key) => ({ value: key, label: specLabel(name, key, locale) }))} />
        ))}
      </div>
      {groupNames.map((group) => (
        <fieldset key={group} className="feature-group">
          <legend>{groupTitles[group][locale]}</legend>
          {groupKeys(group).map((key) => (
            <Checkbox key={key} checked={features.includes(key)} onChange={(event) => setFeatures(event.target.checked ? [...features, key] : features.filter((item) => item !== key))}>
              {featureLabel(key, locale)}
            </Checkbox>
          ))}
        </fieldset>
      ))}
      <input type="hidden" name="features" value={features.join("|")} />
    </div>
  );
}
