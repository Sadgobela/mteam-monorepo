import type { Dict } from "@mteam/shared";

export function SearchBar({ t }: { t: Dict }) {
  return (
    <form className="search" role="search" action="" method="get">
      <label>
        <small>{t.search.location}</small>
        <input name="q" defaultValue="თბილისი, ვაკე" />
      </label>
      <label>
        <small>{t.search.type}</small>
        <select name="type" defaultValue="apartment">
          <option value="apartment">ბინა</option>
          <option value="house">სახლი</option>
          <option value="commercial">კომერციული</option>
        </select>
      </label>
      <label>
        <small>{t.search.price}</small>
        <input name="price" defaultValue="$80k–$200k" />
      </label>
      <label>
        <small>{t.search.rooms}</small>
        <input name="rooms" defaultValue="2–3" />
      </label>
      <button className="btn" type="submit">{t.search.submit}</button>
    </form>
  );
}
