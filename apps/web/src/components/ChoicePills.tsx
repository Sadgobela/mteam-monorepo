"use client";

/** One choice from a short list, as buttons that wrap on a phone. Pressing the chosen one clears it. */
export function ChoicePills<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <div className="choice-pills" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={option.value === value} onClick={() => onChange(option.value === value ? undefined : option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
