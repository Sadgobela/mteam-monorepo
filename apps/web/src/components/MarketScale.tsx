import type { Dict } from "@mteam/shared";

export function MarketScale({ level, t }: { level: number; t: Dict }) {
  return (
    <div className="market">
      <small className="meta">{t.market.heading}</small>
      <div className="market-bar" aria-hidden="true">
        {t.market.levels.map((label, index) => (
          <span key={label} data-on={index === level - 1 ? "" : undefined} />
        ))}
      </div>
      <b>{t.market.levels[level - 1]}</b>
      <div className="meta">{t.market.hint}</div>
    </div>
  );
}
