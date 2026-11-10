import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getDictionary, type Listing } from "@mteam/shared";
import { fixtureListings } from "@/test-fixtures";
import { Select } from "antd";
import { AntProvider } from "./AntProvider";
import { ChoicePills } from "./ChoicePills";
import { CardPhotos } from "./CardPhotos";
import { Pager } from "./Pager";
import { LanguageMenu } from "./LanguageMenu";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { ListingDetails } from "./ListingDetails";
import { EmptyState } from "./EmptyState";
import { FilterChips } from "./FilterChips";
import { FormSelect } from "./FormSelect";
import { Header } from "./Header";
import { ListingCard } from "./ListingCard";
import { SearchBar } from "./SearchBar";
import { Segmented } from "./Segmented";

vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeEach(() => push.mockClear());

const t = getDictionary("en");

describe("Header", () => {
  it("shows navigation and marks the current language", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    expect(screen.getByRole("link", { name: "For sale" })).toHaveAttribute("href", "/en?deal=sale");
    expect(screen.getByRole("link", { name: "MTeam Verified" })).toHaveAttribute("href", "/en?verified=1");
    expect(screen.getByRole("button", { name: "Language: English" })).toHaveTextContent("EN");
  });

  it("links the drawn logo home, with a name screen readers can announce", () => {
    render(<Header locale="en" t={t} signedIn={false} />);
    const home = screen.getByRole("link", { name: "MTeam" });
    expect(home).toHaveAttribute("href", "/en");
    expect(home.querySelectorAll("svg path")).toHaveLength(2);
  });

  describe("phone menu", () => {
    const menu = () => screen.getByRole("button", { name: "Menu" });
    const panel = () => document.querySelector(".menu-panel") as HTMLElement;
    const expectClosed = () => expect(menu()).toHaveAttribute("aria-expanded", "false");

    it("starts closed and opens with the same navigation", () => {
      render(<Header locale="en" t={t} signedIn={false} />);
      expectClosed();
      expect(panel()).toBeNull();
      fireEvent.click(menu());
      expect(menu()).toHaveAttribute("aria-expanded", "true");
      expect(within(panel()).getByRole("link", { name: "For rent" })).toHaveAttribute("href", "/en?deal=rent");
      expect(within(panel()).getByRole("link", { name: "Sign in" })).toBeInTheDocument();
      expect(within(panel()).getByRole("button", { name: "Language: English" })).toBeInTheDocument();
    });

    it("closes when a link is followed, because a same-page link would otherwise leave it open", () => {
      render(<Header locale="en" t={t} signedIn={false} />);
      fireEvent.click(menu());
      fireEvent.click(within(panel()).getByRole("link", { name: "For rent" }));
      expectClosed();
    });

    it("stays open while the theme is changed", () => {
      render(<Header locale="en" t={t} signedIn={false} />);
      fireEvent.click(menu());
      fireEvent.click(within(panel()).getByRole("button", { name: /mode/ }));
      expect(menu()).toHaveAttribute("aria-expanded", "true");
    });

    it("closes on submit rather than on the click, so sign out still reaches the server", () => {
      render(<Header locale="en" t={t} signedIn />);
      fireEvent.click(menu());
      const signOut = within(panel()).getByRole("button", { name: "Sign out" });
      // Cancelled so only the click is seen here; removing the form on the click is what used to lose the submit.
      panel().addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(signOut);
      expect(menu()).toHaveAttribute("aria-expanded", "true");
      fireEvent.submit(signOut.closest("form") as HTMLFormElement);
      expectClosed();
    });

    it("closes with its own close button and offers the signed-in links", () => {
      render(<Header locale="en" t={t} signedIn />);
      fireEvent.click(menu());
      expect(within(panel()).getByRole("link", { name: "My listings" })).toBeInTheDocument();
      expect(within(panel()).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
      fireEvent.click(document.querySelector(".ant-drawer-close") as HTMLElement);
      expectClosed();
    });

    it("closes with a second press", () => {
      render(<Header locale="en" t={t} signedIn />);
      fireEvent.click(menu());
      fireEvent.click(menu());
      expectClosed();
    });
  });
});

describe("AntProvider", () => {
  it("names the clear button in the page language", () => {
    const { container } = render(
      <AntProvider locale="ka">
        <Select allowClear value="a" options={[{ value: "a", label: "A" }]} />
      </AntProvider>,
    );
    expect(container.querySelector(`[aria-label="${getDictionary("ka").search.clear}"]`)).not.toBeNull();
  });
});

describe("LanguageMenu", () => {
  const open = (locale: "ka" | "en" = "en") => {
    render(<LanguageMenu locale={locale} label="Language" />);
    fireEvent.click(screen.getByRole("button", { name: /^Language/ }));
  };
  const option = (name: string) => screen.getByRole("link", { name, hidden: true });

  afterEach(() => window.history.pushState({}, "", "/"));

  it("names the current language and offers all three in their own script, each with a flag", () => {
    open();
    expect(screen.getByRole("button", { name: "Language: English" })).toBeInTheDocument();
    for (const name of ["ქართული", "English", "Русский"]) expect(option(name).querySelector("svg.flag")).not.toBeNull();
    expect(option("Русский")).toHaveAttribute("href", "/ru");
  });

  it("keeps the page for a middle-click or long-press too, which never fire click", () => {
    window.history.pushState({}, "", "/en/brokers?x=1");
    open();
    fireEvent.pointerDown(option("ქართული"));
    expect(option("ქართული")).toHaveAttribute("href", "/ka/brokers?x=1");
  });

  it("marks the current language as selected", () => {
    open("ka");
    expect(option("ქართული").closest("li")).toHaveClass("ant-dropdown-menu-item-selected");
    expect(option("English").closest("li")).not.toHaveClass("ant-dropdown-menu-item-selected");
  });

  it("keeps the page and its filters when the language changes", () => {
    window.history.pushState({}, "", "/en/listings/5?cur=gel&deal=rent");
    open();
    // Cancelled after the component's handler, because jsdom cannot navigate.
    option("Русский").addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(option("Русский"));
    expect(option("Русский")).toHaveAttribute("href", "/ru/listings/5?cur=gel&deal=rent");
  });
});

describe("FormSelect", () => {
  const options = [
    { value: "a", label: "Apple" },
    { value: "b", label: "Banana" },
  ];
  const guard = (container: HTMLElement) => container.querySelector("input[name=fruit]") as HTMLInputElement;

  it("starts on its initial value and is required unless optional", () => {
    const { container, rerender } = render(<FormSelect name="fruit" label="Fruit" options={options} initial="a" />);
    expect(guard(container)).toHaveValue("a");
    expect(guard(container)).toBeRequired();
    expect(screen.getByLabelText("Fruit")).toHaveAttribute("role", "combobox");
    rerender(<FormSelect name="fruit" label="Fruit" options={options} optional />);
    expect(guard(container)).not.toBeRequired();
  });

  it("puts the chosen value in the form and reports it", () => {
    const onChange = vi.fn();
    const { container } = render(<FormSelect name="fruit" label="Fruit" options={options} onChange={onChange} />);
    fireEvent.mouseDown(screen.getByLabelText("Fruit"));
    fireEvent.click(document.querySelector('.ant-select-item-option[title="Banana"]') as Element);
    expect(guard(container)).toHaveValue("b");
    expect(onChange).toHaveBeenLastCalledWith("b");
  });

  it("can be cleared when optional, and works without a listener", () => {
    const { container } = render(<FormSelect name="fruit" label="Fruit" options={options} initial="a" optional />);
    fireEvent.mouseDown(container.querySelector(".ant-select-clear") as Element);
    fireEvent.click(container.querySelector(".ant-select-clear") as Element);
    expect(guard(container)).toHaveValue("");
  });

  it("ignores text typed or autofilled into the hidden field", () => {
    const { container } = render(<FormSelect name="fruit" label="Fruit" options={options} initial="a" />);
    fireEvent.change(guard(container), { target: { value: "not a fruit" } });
    expect(guard(container)).toHaveValue("a");
  });
});

describe("ConfirmSubmit", () => {
  const form = (submitted: (data: FormData) => void) =>
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted(new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter));
        }}
      >
        <ConfirmSubmit label="Reject" question="Sure?" yes="Yes" no="No" name="decision" value="REJECTED" />
      </form>,
    );

  it("asks first and does nothing if refused", async () => {
    const submitted = vi.fn();
    form(submitted);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Sure?")).toBeInTheDocument();
    expect(submitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(submitted).not.toHaveBeenCalled();
  });

  it("submits with its name and value once confirmed", async () => {
    const submitted = vi.fn();
    form(submitted);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(submitted).toHaveBeenCalled());
    expect((submitted.mock.calls[0][0] as FormData).get("decision")).toBe("REJECTED");
  });
});

describe("EmptyState", () => {
  it("says why the page is empty", () => {
    render(<EmptyState text="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});

describe("ListingDetails", () => {
  const listing = fixtureListings[0];

  it("shows nothing when no details were given", () => {
    const { container } = render(<ListingDetails listing={listing} locale="en" t={t} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows given details and groups features, leaving out the rest", () => {
    render(<ListingDetails listing={{ ...listing, specs: { heating: "central" }, features: ["lift", "fridge"], bedrooms: 2, ceiling: 3, yearBuilt: 2019 }} locale="en" t={t} />);
    expect(screen.getByText("Central heating")).toBeInTheDocument();
    expect(screen.getByText("Lift")).toBeInTheDocument();
    expect(screen.getByText("Refrigerator")).toBeInTheDocument();
    expect(screen.getByText("Bedrooms").nextSibling).toHaveTextContent("2");
    expect(screen.queryByText("Parking")).toBeNull();
    expect(screen.queryByText("Utilities")).toBeNull();
  });

  it("works with numbers only or features only", () => {
    const { rerender, container } = render(<ListingDetails listing={{ ...listing, yearBuilt: 2019 }} locale="en" t={t} />);
    expect(container.querySelector(".spec-grid")).not.toBeNull();
    rerender(<ListingDetails listing={{ ...listing, features: ["lift"] }} locale="en" t={t} />);
    expect(container.querySelector(".spec-grid")).toBeNull();
    expect(screen.getByText("Lift")).toBeInTheDocument();
  });
});

describe("CardPhotos", () => {
  it("shows no arrows for a single photo", () => {
    const { container } = render(<CardPhotos images={["https://cdn/a.jpg"]} alt="Flat" />);
    expect(container.querySelector(".strip-nav")).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("describes only the first photo, so a card's name does not repeat", () => {
    const { container } = render(<CardPhotos images={["https://cdn/a.jpg", "https://cdn/b.jpg"]} alt="Flat" />);
    expect([...container.querySelectorAll("img")].map((image) => image.getAttribute("alt"))).toEqual(["Flat", ""]);
  });

  it("scrolls one photo at a time without following the card's link", () => {
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy;
    const { container } = render(<CardPhotos images={["https://cdn/a.jpg", "https://cdn/b.jpg"]} alt="Flat" />);
    Object.defineProperty(container.querySelector(".strip"), "clientWidth", { value: 300 });
    expect(fireEvent.click(container.querySelector(".strip-nav.next") as Element)).toBe(false);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 300, behavior: "smooth" });
    fireEvent.click(container.querySelector(".strip-nav.previous") as Element);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: "smooth" });
  });
});

describe("Pager", () => {
  const pager = (page: number, total = 96) => render(<Pager locale="en" t={t} query={{ deal: "sale" }} page={page} total={total} size={24} />);

  it("links each page and keeps the filters", () => {
    pager(2);
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("href", "/en?deal=sale&page=3");
    expect(screen.getByRole("link", { name: "← Previous" })).toHaveAttribute("href", "/en?deal=sale&page=1");
    expect(screen.getByRole("link", { name: "Next →" })).toHaveAttribute("href", "/en?deal=sale&page=3");
  });

  it("has no previous on the first page and no next on the last", () => {
    pager(1);
    expect(screen.queryByRole("link", { name: "← Previous" })).toBeNull();
    pager(4);
    expect(screen.getAllByRole("link", { name: "← Previous" })).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Next →" })).toHaveLength(1);
  });

  it("works from the keyboard, and a click navigates once through its link", () => {
    pager(2);
    const link = screen.getByRole("link", { name: "3" });
    fireEvent.keyDown(link.closest("li") as Element, { key: "Enter", keyCode: 13, which: 13 });
    expect(push).toHaveBeenCalledWith("/en?deal=sale&page=3");
    push.mockClear();
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(push).not.toHaveBeenCalled();
  });

  it("skips ahead on long result sets", () => {
    pager(10, 480);
    expect(screen.getAllByRole("link", { name: "…" }).length).toBeGreaterThan(0);
  });
});

describe("Segmented", () => {
  const options = [
    { text: "One", href: "/one", active: true },
    { text: "Two", href: "/two", active: false },
  ];

  it("goes to the chosen URL without scrolling", async () => {
    render(<Segmented label="Choice" options={options} />);
    expect(screen.getByRole("radiogroup", { name: "Choice" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "One" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Two" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/two", { scroll: false }));
  });

  it("highlights the first choice when none is active", () => {
    render(<Segmented label="Choice" options={[{ ...options[0], active: false }, options[1]]} />);
    expect(screen.getByRole("radio", { name: "One" })).toBeChecked();
  });
});

describe("FilterChips", () => {
  const all = {
    deal: "rent",
    type: "land",
    city: "ბათუმი",
    q: "marina",
    verified: true,
    rooms: 2,
    priceMin: 100,
    priceMax: 200,
    areaMin: 40,
    areaMax: 90,
    floorMin: 3,
    floorMax: 9,
  } as const;

  it("renders nothing with no filters", () => {
    const { container } = render(<FilterChips locale="en" t={t} query={{}} filters={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each active filter as a link that removes only it", () => {
    render(<FilterChips locale="en" t={t} query={{ deal: "rent", city: "ბათუმი", page: "3" }} filters={all} />);
    expect(screen.getAllByRole("link")).toHaveLength(12);
    expect(screen.getByRole("link", { name: "Remove filter: Floor from 3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: Batumi" })).toHaveAttribute("href", "/en?deal=rent&city=&page=1");
    expect(screen.getByRole("link", { name: "Remove filter: Area from, m² 40" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: marina" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Remove filter: MTeam Verified" })).toBeInTheDocument();
  });
});

describe("SearchBar", () => {
  const display = { sort: "new", view: "grid", cur: "usd", page: 1 } as const;
  const bar = (filters = {}, shown: typeof display | { sort: "asc"; view: "list"; cur: "gel"; page: 1 } = display) =>
    render(<SearchBar locale="en" t={t} filters={filters} display={shown} />);
  const box = (name: string) => screen.getByRole("combobox", { name });
  const keyword = () => screen.getByRole("textbox", { name: "ID, street or keyword" });
  const submit = () => fireEvent.submit(screen.getByRole("search"));
  const openMore = () => fireEvent.click(screen.getByRole("button", { name: /More filters/ }));
  const pick = (name: string, option: string) => {
    fireEvent.mouseDown(box(name));
    fireEvent.click(document.querySelector(`.ant-select-item-option[title="${option}"]`) as HTMLElement);
  };
  const pushed = () => new URLSearchParams((push.mock.lastCall as [string])[0].slice(1));

  it("starts with every filter off and the extra filters closed", () => {
    bar();
    expect(screen.getByRole("search")).toHaveAttribute("novalidate");
    expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
    expect(box("Deal")).toBeInTheDocument();
    expect(box("Type")).toBeInTheDocument();
    expect(keyword()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Location" })).toHaveTextContent("City, district");
    expect(screen.getByLabelText("Verified only")).not.toBeChecked();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector(".ant-badge-count")).toBeNull();
  });

  it("shows the active filters and counts the ones behind the button", () => {
    bar({ deal: "rent", city: "ბათუმი", type: "land", priceMin: 1000, priceMax: 2000, rooms: 4, q: "vake", verified: true, areaMin: 40, floorMax: 9 });
    expect(screen.getByText("For rent")).toBeInTheDocument();
    expect(screen.getByText("Land")).toBeInTheDocument();
    expect(keyword()).toHaveValue("vake");
    expect(screen.getByRole("button", { name: "Location: Batumi" })).toHaveTextContent("Batumi");
    expect(screen.getByLabelText("Verified only")).toBeChecked();
    expect(document.querySelector(".ant-badge-count")).toHaveAttribute("title", "5");
    openMore();
    expect(within(document.querySelector('.ant-modal [aria-label="Rooms"]') as HTMLElement).getByText("4")).toBeChecked();
    expect(screen.getByLabelText("Price from, $")).toHaveValue("1000");
    expect(screen.getByLabelText("Price to, $")).toHaveValue("2000");
    expect(screen.getByLabelText("Area from, m²")).toHaveValue("40");
    expect(screen.getByLabelText("Floor to")).toHaveValue("9");
  });

  it("marks keyboard use, and forgets it on a mouse press, so only tabbing shows a focus ring", () => {
    bar();
    const form = screen.getByRole("search");
    fireEvent.keyUp(form, { key: "a" });
    expect(form).not.toHaveAttribute("data-keyboard");
    fireEvent.keyUp(form, { key: "Tab" });
    expect(form).toHaveAttribute("data-keyboard");
    fireEvent.mouseDown(form);
    expect(form).not.toHaveAttribute("data-keyboard");
  });

  it("always sends deal and the display choices, so an empty search still shows results", async () => {
    bar({}, { sort: "asc", view: "list", cur: "gel", page: 1 });
    submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("?deal=&cur=gel&view=list&sort=asc"));
  });

  it("searches with what was chosen in the bar", async () => {
    bar();
    pick("Deal", "For rent");
    pick("Type", "House");
    fireEvent.click(screen.getByLabelText("Verified only"));
    submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(Object.fromEntries(pushed())).toEqual({ deal: "rent", type: "house", verified: "1", cur: "usd", view: "grid", sort: "new" });
  });

  it("drops a filter that was switched back off", async () => {
    bar({ verified: true, q: "vake" });
    fireEvent.click(screen.getByLabelText("Verified only"));
    fireEvent.change(keyword(), { target: { value: "" } });
    submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(pushed().has("verified")).toBe(false);
    expect(pushed().has("q")).toBe(false);
  });

  describe("filter row", () => {
    const row = (filters = {}) => render(<SearchBar locale="en" t={t} filters={filters} display={display} results />);
    const pillButton = (name: string) => screen.getByText(name, { selector: "button span" }).closest("button") as HTMLElement;
    const panel = () => within(document.querySelector(".pill-panel") as HTMLElement);

    it("is only there on results", () => {
      bar();
      expect(document.querySelector(".pills")).toBeNull();
    });

    it("searches from the price button and closes it", async () => {
      row();
      fireEvent.click(pillButton("Price"));
      fireEvent.change(panel().getByLabelText("Price from, $"), { target: { value: "500" } });
      fireEvent.click(panel().getByText("Search"));
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("priceMin")).toBe("500");
    });

    it("closes when pressed again", async () => {
      row();
      fireEvent.click(pillButton("Area"));
      expect(document.querySelector(".pill-panel")).not.toBeNull();
      fireEvent.click(pillButton("Area"));
      await waitFor(() => expect(document.querySelector(".ant-popover-hidden")).not.toBeNull());
    });

    it("shows which filters are on", () => {
      row({ floorMin: 2, rooms: 3, building: ["new"], areaMax: 50, priceMin: 1 });
      for (const name of ["Price", "Area", "Rooms", "Floor", "Status"]) expect(pillButton(name)).toHaveClass("active");
    });

    it("leaves buttons plain when nothing is set", () => {
      row();
      expect(pillButton("Price")).not.toHaveClass("active");
    });

    it("adds and removes building statuses", async () => {
      row({ building: ["old"] });
      fireEvent.click(pillButton("Status"));
      const status = (name: string) => panel().getByText(name).closest("label")?.querySelector("input") as HTMLInputElement;
      expect(status("Old building")).toBeChecked();
      fireEvent.click(status("Under construction"));
      fireEvent.click(status("Old building"));
      fireEvent.click(panel().getByText("Search"));
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("building")).toBe("construction");
    });

    it("adds the first building status", async () => {
      row();
      fireEvent.click(pillButton("Status"));
      fireEvent.click(panel().getByText("New building"));
      fireEvent.click(panel().getByText("Search"));
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("building")).toBe("new");
    });

    it("drops the status filter when the last one is unticked", async () => {
      row({ building: ["old"] });
      fireEvent.click(pillButton("Status"));
      fireEvent.click(panel().getByText("Old building"));
      fireEvent.click(panel().getByText("Search"));
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().has("building")).toBe(false);
    });
  });

  describe("extra filters", () => {
    // ByText and selectors, because ByRole works out accessibility for every node and this panel has hundreds.
    const panelElement = () => document.querySelector(".ant-modal") as HTMLElement;
    const dialog = () => within(panelElement());
    const tickBox = (name: string) => dialog().getByText(name).closest("label")?.querySelector("input") as HTMLInputElement;
    const apply = () => fireEvent.click(dialog().getByText("Search"));
    const combo = (name: string) => panelElement().querySelector(`input[aria-label="${name}"]`) as HTMLInputElement;

    it("applies price per m² and owners only, and can untick owners", async () => {
      bar({ owner: true });
      openMore();
      const owners = tickBox("Owners only");
      expect(owners).toBeChecked();
      fireEvent.click(owners);
      fireEvent.click(owners);
      fireEvent.change(dialog().getByLabelText("Price per m² from, $"), { target: { value: "700" } });
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(Object.fromEntries(pushed())).toMatchObject({ owner: "1", sqmMin: "700" });
    });

    it("drops owners only when it is unticked", async () => {
      bar({ owner: true });
      openMore();
      fireEvent.click(tickBox("Owners only"));
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().has("owner")).toBe(false);
    });

    it("offers metro stations in Tbilisi or with no city, and chooses one", async () => {
      bar({ city: "თბილისი" });
      openMore();
      fireEvent.mouseDown(combo("Metro"));
      fireEvent.click(document.querySelector('.ant-select-item-option[title="Akhmetelis Teatri"]') as HTMLElement);
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("metro")).toBe("ახმეტელის თეატრი");
    });

    it("sets bedrooms and the floor position, and clears them with a second press", async () => {
      bar();
      openMore();
      const choose = (group: string, name: string) => fireEvent.click(within(panelElement().querySelector(`[aria-label="${group}"]`) as HTMLElement).getByText(name));
      choose("Bedrooms", "3");
      choose("Floor position", "Last");
      choose("Floor position", "Not first");
      choose("Bedrooms", "3");
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("floorPos")).toBe("notFirst");
      expect(pushed().has("bedrooms")).toBe(false);
    });

    it("chooses several values for a detail, and drops the filter when none are left", async () => {
      bar();
      openMore();
      const heating = combo("Heating");
      fireEvent.mouseDown(heating);
      fireEvent.click(document.querySelector('.ant-select-item-option[title="Central heating"]') as Element);
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("heating")).toBe("central");
    });

    it("drops a detail filter when its last value is removed", async () => {
      bar({ heating: ["central"] });
      openMore();
      fireEvent.mouseDown(combo("Heating"));
      fireEvent.click(document.querySelector('.ant-select-item-option[title="Central heating"]') as Element);
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().has("heating")).toBe(false);
    });

    it("ticks features, keeping the others when one is removed", async () => {
      bar({ features: ["lift", "sauna"] });
      openMore();
      const box = tickBox;
      expect(box("Lift")).toBeChecked();
      fireEvent.click(box("Lift"));
      fireEvent.click(box("Bar"));
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("features")).toBe("sauna|bar");
    });

    it("adds the first feature, and drops the filter with the last one", async () => {
      const { unmount } = bar();
      openMore();
      fireEvent.click(tickBox("Bar"));
      fireEvent.click(tickBox("Bar"));
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().has("features")).toBe(false);
      unmount();
    });

    it("shows money in lari when lari is on, but searches in dollars", async () => {
      render(<SearchBar locale="en" t={t} filters={{ priceMin: 100 }} display={{ ...display, cur: "gel" }} />);
      openMore();
      expect(dialog().getByLabelText("Price from, ₾")).toHaveValue("270");
      fireEvent.change(dialog().getByLabelText("Price to, ₾"), { target: { value: "540" } });
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(Object.fromEntries(pushed())).toMatchObject({ priceMin: "100", priceMax: "200" });
    });

    it("hides metro stations in a city without a metro", () => {
      bar({ city: "ბათუმი" });
      openMore();
      expect(combo("Metro")).toBeNull();
    });
  });

  describe("location picker", () => {
    const openPicker = () => fireEvent.click(screen.getByRole("button", { name: /^Location/ }));
    // ByText, because ByRole works out accessibility for every node and there are thousands here.
    const picker = () => within(document.querySelector(".ant-modal") as HTMLElement);
    const cityButton = (name: string) => picker().getByText(name, { selector: "button" });
    const city = (name: string) => fireEvent.click(cityButton(name));
    const districtBox = (name: string) => picker().getByText(name).closest("label")?.querySelector("input") as HTMLInputElement;
    const noBox = (name: string) => expect(picker().queryByText(name)).toBeNull();
    const tick = (name: string) => fireEvent.click(districtBox(name));
    const footer = (name: string) => fireEvent.click(within(document.querySelector(".loc-foot") as HTMLElement).getByText(name));
    const apply = () => footer("Search");

    it("asks for a city first, then searches its chosen districts and closes", async () => {
      bar();
      openPicker();
      expect(picker().getByText("Choose a city to see its districts.")).toBeInTheDocument();
      city("Tbilisi");
      expect(picker().queryByText("Choose a city to see its districts.")).toBeNull();
      tick("Vake");
      tick("Vera");
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(Object.fromEntries(pushed())).toMatchObject({ city: "თბილისი", district: "ვაკე|ვერა" });
      expect(screen.getByRole("button", { name: "Location: Tbilisi +2" })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("searches a whole city when no district is ticked", async () => {
      bar();
      openPicker();
      city("Rustavi");
      expect(document.querySelector(".loc-columns input")).toBeNull();
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("city")).toBe("რუსთავი");
      expect(pushed().has("district")).toBe(false);
    });

    it("ticks a whole group at once, shows when it is partly ticked, and unticks it", () => {
      bar({ city: "თბილისი", district: ["ვაკე"] });
      openPicker();
      const group = () => districtBox("Vake-Saburtalo");
      expect(districtBox("Vake")).toBeChecked();
      expect(group()).not.toBeChecked();
      expect(group().closest(".ant-checkbox")).toHaveClass("ant-checkbox-indeterminate");
      fireEvent.click(group());
      expect(group()).toBeChecked();
      expect(districtBox("Saburtalo")).toBeChecked();
      fireEvent.click(group());
      expect(districtBox("Vake")).not.toBeChecked();
      expect(group().closest(".ant-checkbox")).not.toHaveClass("ant-checkbox-indeterminate");
    });

    it("shows plain districts for a city without groups", () => {
      bar();
      openPicker();
      city("Batumi");
      tick("Makhinjauri");
      expect(districtBox("Makhinjauri")).toBeChecked();
    });

    it("narrows cities and districts as you type, in either language", () => {
      bar();
      openPicker();
      fireEvent.change(picker().getByRole("textbox"), { target: { value: "vazis" } });
      expect(cityButton("Tbilisi")).toBeInTheDocument();
      noBox("Gudauri");
      city("Tbilisi");
      expect(districtBox("Vazisubani")).toBeInTheDocument();
      noBox("Vake");
      fireEvent.change(picker().getByRole("textbox"), { target: { value: "ვაზისუბანი" } });
      expect(districtBox("Vazisubani")).toBeInTheDocument();
    });

    it("shows every district of a city that was found by its own name", () => {
      bar();
      openPicker();
      fireEvent.change(picker().getByRole("textbox"), { target: { value: "kutaisi" } });
      city("Kutaisi");
      expect(districtBox("Nikea")).toBeInTheDocument();
    });

    it("ticks only the districts on show when a group is filtered", async () => {
      bar();
      openPicker();
      fireEvent.change(picker().getByRole("textbox"), { target: { value: "vazis" } });
      city("Tbilisi");
      tick("Isani-Samgori");
      expect(districtBox("Isani-Samgori")).toBeChecked();
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("district")).toBe("ვაზისუბანი");
    });

    it("sends no district list when every district is ticked, since that is the whole city", async () => {
      bar();
      openPicker();
      city("Gurjaani");
      tick("Gurjaani (Sopeli)");
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("city")).toBe("გურჯაანი");
      expect(pushed().has("district")).toBe(false);
    });

    const showStreets = async (count: number) => {
      fireEvent.click(await picker().findByText(`Streets (${count})`));
      await waitFor(() => expect(document.querySelector(".loc-columns input")).not.toBeNull());
    };

    it("offers the ticked district's streets and searches the chosen one", async () => {
      bar();
      openPicker();
      city("Tbilisi");
      expect(picker().queryByText(/^Streets/)).toBeNull();
      tick("Vake");
      await showStreets(57);
      tick("Chavchavadze I. Ave.");
      fireEvent.click(picker().getByText("Districts"));
      expect(districtBox("Vake")).toBeChecked();
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(Object.fromEntries(pushed())).toMatchObject({ district: "ვაკე", street: "ჭავჭავაძე ი. გამზირი" });
      expect(screen.getByRole("button", { name: "Location: Tbilisi +2" })).toBeInTheDocument();
    });

    it("unticks a street, and narrows the list as you type", async () => {
      bar();
      openPicker();
      city("Rustavi");
      await showStreets(115);
      const first = (document.querySelector(".loc-columns label") as HTMLElement).textContent as string;
      tick(first);
      expect(districtBox(first)).toBeChecked();
      tick(first);
      expect(districtBox(first)).not.toBeChecked();
      fireEvent.change(picker().getByRole("textbox"), { target: { value: first } });
      expect(document.querySelectorAll(".loc-columns label")).toHaveLength(1);
    });

    it("keeps every ticked street, because listings without a street must stay out", async () => {
      bar();
      openPicker();
      city("Gudauri");
      await showStreets(4);
      for (const input of document.querySelectorAll<HTMLInputElement>(".loc-columns input")) fireEvent.click(input);
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("street")?.split("|")).toHaveLength(4);
    });

    it("keeps a street filter when applied before the street list has arrived", async () => {
      bar({ city: "რუსთავი", street: ["ატენის ქ."] });
      openPicker();
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("street")).toBe("ატენის ქ.");
    });

    it("keeps the district when every one is ticked but a street depends on it", async () => {
      bar();
      openPicker();
      city("Gurjaani");
      tick("Gurjaani (Sopeli)");
      fireEvent.click(await picker().findByText(/^Streets/));
      await waitFor(() => expect(document.querySelector(".loc-columns label")?.textContent).not.toBe("Gurjaani (Sopeli)"));
      tick((document.querySelector(".loc-columns label") as HTMLElement).textContent as string);
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().get("district")).toBe("გურჯაანი (სოფელი)");
      expect(pushed().has("street")).toBe(true);
    });

    it("goes back to districts when the city changes", async () => {
      bar();
      openPicker();
      city("Tbilisi");
      tick("Vake");
      await showStreets(57);
      city("Batumi");
      tick("Makhinjauri");
      await picker().findByText(/^Streets/);
      expect(districtBox("Makhinjauri")).toBeChecked();
    });

    it("drops a street whose district was unticked", async () => {
      bar({ city: "თბილისი", district: ["ვაკე"], street: ["ჭავჭავაძე ი. გამზირი"] });
      openPicker();
      await picker().findByText("Streets (57)");
      tick("Vake");
      await waitFor(() => expect(picker().queryByText(/^Streets/)).toBeNull());
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().has("street")).toBe(false);
    });

    it("forgets chosen streets when the city changes or the picker is cleared", async () => {
      bar({ city: "რუსთავი", street: ["ატენის ქ."] });
      openPicker();
      await picker().findByText("Streets (115)");
      city("Batumi");
      city("Rustavi");
      await showStreets(115);
      footer("Clear");
      expect(picker().queryByText(/^Streets/)).toBeNull();
      expect(picker().getByText("Choose a city to see its districts.")).toBeInTheDocument();
    });

    it("forgets ticked districts when the city changes, not when it is pressed again", () => {
      bar({ city: "თბილისი", district: ["ვაკე"] });
      openPicker();
      city("Tbilisi");
      expect(districtBox("Vake")).toBeChecked();
      city("Batumi");
      city("Tbilisi");
      expect(districtBox("Vake")).not.toBeChecked();
    });

    it("clears the place, and dismissing forgets what was not applied", async () => {
      bar({ city: "თბილისი", district: ["ვაკე"] });
      openPicker();
      city("Batumi");
      fireEvent.click(document.querySelector(".ant-modal-close") as HTMLElement);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(push).not.toHaveBeenCalled();
      openPicker();
      expect(cityButton("Tbilisi")).toHaveAttribute("aria-pressed", "true");
      footer("Clear");
      expect(picker().getByText("Choose a city to see its districts.")).toBeInTheDocument();
      apply();
      await waitFor(() => expect(push).toHaveBeenCalled());
      expect(pushed().has("city")).toBe(false);
    });
  });

  it("applies the extra filters from the panel and closes it", async () => {
    bar();
    openMore();
    fireEvent.click(within(document.querySelector('.ant-modal [aria-label="Rooms"]') as HTMLElement).getByText("4"));
    fireEvent.change(screen.getByLabelText("Price from, $"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Floor to"), { target: { value: "9" } });
    fireEvent.keyDown(screen.getByLabelText("Floor to"), { key: "Enter", keyCode: 13 });
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(Object.fromEntries(pushed())).toMatchObject({ rooms: "4", priceMin: "500", floorMax: "9" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("turns panel choices back off one at a time", async () => {
    bar({ rooms: 2, priceMin: 100 });
    openMore();
    const panel = within(document.querySelector(".ant-modal") as HTMLElement);
    fireEvent.click(within(document.querySelector('.ant-modal [aria-label="Rooms"]') as HTMLElement).getByText("2"));
    fireEvent.change(panel.getByLabelText("Price from, $"), { target: { value: "" } });
    fireEvent.click(panel.getByText("Search"));
    await waitFor(() => expect(push).toHaveBeenCalled());
    for (const key of ["rooms", "priceMin"]) expect(pushed().has(key)).toBe(false);
  });

  it("clears only the panel's filters and can be dismissed without searching", async () => {
    bar({ deal: "sale", city: "ბათუმი", priceMax: 100 });
    openMore();
    fireEvent.click(within(document.querySelector(".ant-modal") as HTMLElement).getByText("Clear"));
    expect(screen.getByLabelText("Price to, $")).toHaveValue("");
    fireEvent.click(document.querySelector(".ant-modal-close") as HTMLElement);
    expect(push).not.toHaveBeenCalled();
    submit();
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(Object.fromEntries(pushed())).toEqual({ deal: "sale", city: "ბათუმი", cur: "usd", view: "grid", sort: "new" });
  });

  it("writes room counts in full, with the top one as a minimum, in the page language", () => {
    render(<SearchBar locale="ru" t={getDictionary("ru")} filters={{}} display={display} />);
    fireEvent.click(screen.getByRole("button", { name: /Другие фильтры/ }));
    const rooms = within(document.querySelector(`.ant-modal [aria-label="${getDictionary("ru").search.rooms}"]`) as HTMLElement);
    expect(rooms.getByText("10+")).toBeInTheDocument();
    expect(rooms.getByText("3")).toBeInTheDocument();
  });
});

describe("ChoicePills", () => {
  const options = [
    { value: 1, label: "One" },
    { value: 2, label: "Two" },
  ];

  it("marks the choice, reports a new one, and clears on a second press", () => {
    const onChange = vi.fn();
    render(<ChoicePills label="Count" value={1} options={options} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "One" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Two" }));
    expect(onChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("radio", { name: "One" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe("FilterChips details", () => {
  it("names details, bedrooms, floor position and features", () => {
    render(<FilterChips locale="en" t={t} query={{}} filters={{ heating: ["central"], bedrooms: 2, floorPos: "last", features: ["lift", "sauna"] }} />);
    for (const name of ["Heating: Central heating", "Bedrooms 2", "Last", "Lift +1"]) {
      expect(screen.getByRole("link", { name: `Remove filter: ${name}` })).toBeInTheDocument();
    }
  });

  it("names a single feature on its own", () => {
    render(<FilterChips locale="en" t={t} query={{}} filters={{ features: ["lift"] }} />);
    expect(screen.getByRole("link", { name: "Remove filter: Lift" })).toBeInTheDocument();
  });

  it("shows prices in lari when lari is on", () => {
    render(<FilterChips locale="en" t={t} query={{ cur: "gel" }} filters={{ priceMin: 100, priceMax: undefined }} />);
    expect(screen.getByRole("link", { name: "Remove filter: Price from, ₾ 270" })).toBeInTheDocument();
  });

  it("names metro, building status, owners and price per m²", () => {
    render(<FilterChips locale="en" t={t} query={{}} filters={{ metro: "დელისი", building: ["old", "new"], owner: true, sqmMin: 5, sqmMax: 9 }} />);
    for (const name of ["Metro: Delisi", "Old building, New building", "Owners only", "Price per m² from, $ 5", "Price per m² to, $ 9"]) {
      expect(screen.getByRole("link", { name: `Remove filter: ${name}` })).toBeInTheDocument();
    }
  });
});

describe("FilterChips districts", () => {
  it("names one district, and counts the rest", () => {
    const { rerender } = render(<FilterChips locale="en" t={t} query={{ district: "ვაკე" }} filters={{ district: ["ვაკე"] }} />);
    expect(screen.getByRole("link", { name: "Remove filter: Vake" })).toHaveAttribute("href", "/en?district=&page=1&street=");
    rerender(<FilterChips locale="en" t={t} query={{}} filters={{ district: ["ვაკე", "ვერა", "ისანი"] }} />);
    expect(screen.getByRole("link", { name: "Remove filter: Vake +2" })).toBeInTheDocument();
    rerender(<FilterChips locale="en" t={t} query={{ street: "ატენის ქ." }} filters={{ street: ["ატენის ქ."] }} />);
    expect(screen.getByRole("link", { name: "Remove filter: Atenis St." })).toHaveAttribute("href", "/en?street=&page=1");
  });
});

describe("ListingCard", () => {
  it("leads with the price and builds its title from the facts", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} />);
    expect(screen.getByText("$148,000")).toBeInTheDocument();
    expect(screen.getByText("$1,609 / m²")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "For sale: 3-room apartment, Vake" })).toBeInTheDocument();
    expect(screen.getByText("Nov 6")).toBeInTheDocument();
    expect(screen.getByText("3 rooms")).toBeInTheDocument();
  });

  it("shows the price in the chosen currency", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} cur="gel" />);
    expect(screen.getByText("₾399,600")).toBeInTheDocument();
    expect(screen.getByText("₾4,343 / m²")).toBeInTheDocument();
  });

  it("converts a listing priced in another currency", () => {
    render(<ListingCard listing={fixtureListings[2]} locale="en" t={t} />);
    expect(screen.getByText("$100,000")).toBeInTheDocument();
  });

  it("titles property without rooms by its type alone and shows no price per m² on rentals", () => {
    render(<ListingCard listing={{ ...fixtureListings[1], type: "land", rooms: 0 }} locale="en" t={t} />);
    expect(screen.getByRole("heading", { name: "For rent: land, Saburtalo" })).toBeInTheDocument();
    expect(screen.queryByText(/\/ m²/)).toBeNull();
  });

  it("writes the title in the page language", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="ka" t={getDictionary("ka")} />);
    expect(screen.getByRole("heading", { name: "იყიდება 3 ოთახიანი ბინა, ვაკე" })).toBeInTheDocument();
  });

  it("uses the city when a place has no districts", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], city: "რუსთავი", district: "" }} locale="en" t={t} />);
    expect(screen.getByRole("heading", { name: "For sale: 3-room apartment, Rustavi" })).toBeInTheDocument();
    expect(screen.getByText(fixtureListings[0].address)).toBeInTheDocument();
  });

  it("says who checked a verified listing and when", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], verification: { by: "Nino", at: "2026-11-02" } }} locale="en" t={t} />);
    expect(screen.getByText("Checked by Nino, Nov 2")).toBeInTheDocument();
  });

  it("keeps the chosen currency when the listing is opened", () => {
    const { rerender } = render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} cur="gel" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/en/listings/${fixtureListings[0].id}?cur=gel`);
    rerender(<ListingCard listing={fixtureListings[0]} locale="en" t={t} cur="usd" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/en/listings/${fixtureListings[0].id}`);
  });

  it("names the broker when there is one", () => {
    render(<ListingCard listing={fixtureListings[0]} locale="en" t={t} />);
    expect(screen.getByText(fixtureListings[0].agent?.name as string)).toBeInTheDocument();
  });

  it("shows bedrooms when given", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], bedrooms: 2 }} locale="en" t={t} />);
    expect(screen.getByText("2 bedrooms")).toBeInTheDocument();
  });

  it("says photo for a single one", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], images: ["https://cdn/a.jpg"] }} locale="en" t={t} />);
    expect(screen.getByText("1 photo")).toBeInTheDocument();
  });

  it("shows how many photos there are", () => {
    render(<ListingCard listing={{ ...fixtureListings[0], images: ["https://cdn/a.jpg", "https://cdn/b.jpg"] }} locale="en" t={t} />);
    expect(screen.getByText("2 photos")).toBeInTheDocument();
  });

  it("shows a verified sale listing with floor", () => {
    const l = fixtureListings[0];
    render(<ListingCard listing={l} locale="en" t={t} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/en/listings/${l.id}`);
    expect(screen.getByText("MTeam Verified")).toBeInTheDocument();
    expect(screen.getByText(/7\/12 floor/)).toBeInTheDocument();
  });

  it("shows a rent listing per month, without badge or floor", () => {
    const l: Listing = { ...fixtureListings[1], floor: undefined, verified: false };
    render(<ListingCard listing={l} locale="en" t={t} />);
    expect(screen.getByText("/ month")).toBeInTheDocument();
    expect(screen.queryByText("MTeam Verified")).toBeNull();
    expect(screen.queryByText(/floor/)).toBeNull();
  });
});
