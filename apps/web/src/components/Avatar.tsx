import Image from "next/image";
import "@/app/profile.css";

/** A person's photo, or the initials of their name without one. Decorative: the name is always shown next to it. */
export function Avatar({ name, url, large = false }: { name: string | null; url: string | null; large?: boolean }) {
  const className = large ? "av av-lg" : "av";
  const size = large ? 96 : 48;
  if (url) return <Image className={className} src={url} alt="" width={size} height={size} unoptimized />;
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    // Georgian has no capitals in everyday writing; its uppercase forms would look wrong here.
    .replace(/[^\u10D0-\u10FF]/g, (letter) => letter.toUpperCase());
  return (
    <span className={className} aria-hidden="true">
      {initials}
    </span>
  );
}
