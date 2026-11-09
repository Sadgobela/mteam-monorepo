"use client";

import { useId, useState } from "react";
import { Select } from "antd";

/** A searchable dropdown for plain forms. */
export function FormSelect({
  name,
  label,
  options,
  initial = "",
  optional = false,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  initial?: string;
  optional?: boolean;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(initial);

  function choose(next = "") {
    setValue(next);
    onChange?.(next);
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        <small>{label}</small>
      </label>
      <Select id={id} showSearch={{ optionFilterProp: "label" }} allowClear={optional} suffix={null} placeholder="—" value={value || undefined} options={options} onChange={choose} />
      {/* Ant's Select is not a form control. This puts the value in the form and lets the browser enforce "required". Not readOnly, which would switch that off; the empty handler keeps anything typed here or autofilled out. */}
      <input className="select-guard" name={name} required={!optional} value={value} onChange={() => undefined} autoComplete="off" tabIndex={-1} aria-hidden="true" />
    </div>
  );
}
