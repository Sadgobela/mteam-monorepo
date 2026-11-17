import { getDictionary, type PublicListing } from "@mteam/shared";
import { listing } from "@/test/render";
import { cardTitle, factList, factsLine, priceLine, routeForPath, whatsappLink } from "./format";

const flat = listing as unknown as PublicListing;
const en = getDictionary("en");

describe("format", () => {
  it("titles a card from its facts, with or without rooms", () => {
    expect(cardTitle(flat, "en", en)).toBe("For sale: 3-room apartment, Vake");
    expect(cardTitle({ ...flat, rooms: 0, type: "land" }, "en", en)).toBe("For sale: land, Vake");
  });

  it("shows the price in dollars, per month for rentals, converting lari", () => {
    expect(priceLine(flat, en, 2.7)).toBe("$120,000");
    expect(priceLine({ ...flat, deal: "rent", price: 2700, currency: "GEL" }, en, 2.7)).toBe("$1,000 / month");
  });

  it("lists area, rooms and floor when known", () => {
    expect(factsLine(flat, en)).toBe("80 m² · 3 rooms · 4/9 floor");
    expect(factsLine({ ...flat, rooms: 0, floor: undefined }, en)).toBe("80 m²");
    expect(factList(flat, en).map((fact) => fact.kind)).toEqual(["area", "rooms", "floor"]);
  });

  it("builds a WhatsApp link from the digits", () => {
    expect(whatsappLink("+995 555 12-34-56")).toBe("https://wa.me/995555123456");
  });

  it("opens listings, my listings, notifications and searches in the app, anything else on the site", () => {
    expect(routeForPath("/en/listings/7")).toEqual({ screen: "/listings/7" });
    expect(routeForPath("/ka/my-listings")).toEqual({ screen: "/my-listings" });
    expect(routeForPath("/ka/account/notifications")).toEqual({ screen: "/notifications" });
    expect(routeForPath("/ka?deal=rent&city=თბილისი")).toEqual({ screen: "/?deal=rent&city=თბილისი" });
    expect(routeForPath("/en")).toEqual({ screen: "/" });
    expect(routeForPath("/ka/saved")).toEqual({ web: "/ka/saved" });
    expect(routeForPath("/ka/messages/c1")).toEqual({ web: "/ka/messages/c1" });
  });
});
