import Link from "next/link";

/** A row of mutually exclusive choices. They are links, so every state has its own shareable URL. */
export function Segmented({
  label,
  options,
}: {
  label: string;
  options: { text: string; href: string; active: boolean }[];
}) {
  return (
    <div role="group" aria-label={label} className="seg">
      {options.map((option) => (
        <Link key={option.text} href={option.href} scroll={false} aria-current={option.active ? "true" : undefined}>
          {option.text}
        </Link>
      ))}
    </div>
  );
}
