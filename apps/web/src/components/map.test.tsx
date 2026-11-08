import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

const leaflet = vi.hoisted(() => {
  const map = { setView: vi.fn(), fitBounds: vi.fn(), remove: vi.fn(), on: vi.fn(), addLayer: vi.fn() };
  const marker = { bindPopup: vi.fn(), addTo: vi.fn(), setLatLng: vi.fn(), setStyle: vi.fn() };
  return {
    instance: map,
    marker,
    api: {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      circleMarker: vi.fn(() => marker),
      latLngBounds: vi.fn((points: unknown) => points),
    },
  };
});

vi.mock("leaflet", () => ({ default: leaflet.api }));

import { ListingMap } from "./ListingMap";
import { LocationPicker } from "./LocationPicker";

beforeEach(() => {
  vi.clearAllMocks();
  leaflet.instance.setView.mockReturnValue(leaflet.instance);
  leaflet.marker.bindPopup.mockReturnValue(leaflet.marker);
  leaflet.marker.addTo.mockReturnValue(leaflet.marker);
  leaflet.marker.setLatLng.mockReturnValue(leaflet.marker);
});

describe("ListingMap", () => {
  const points = [
    { id: 1, lat: 41.7, lng: 44.7, label: "<b>Flat</b>", href: "/en/listings/1" },
    { id: 2, lat: 41.6, lng: 41.6, label: "Other", href: "/en/listings/2" },
  ];

  it("places a linked marker per listing and fits them in view", async () => {
    render(<ListingMap points={points} label="Map" />);
    expect(screen.getByRole("region", { name: "Map" })).toBeInTheDocument();
    await waitFor(() => expect(leaflet.instance.fitBounds).toHaveBeenCalled());

    expect(leaflet.api.circleMarker).toHaveBeenCalledTimes(2);
    expect(leaflet.instance.setView).not.toHaveBeenCalled();
    const popup = leaflet.marker.bindPopup.mock.calls[0][0] as HTMLAnchorElement;
    expect(popup.getAttribute("href")).toBe("/en/listings/1");
  });

  it("never turns a user-written title into HTML", async () => {
    render(<ListingMap points={points} label="Map" />);
    await waitFor(() => expect(leaflet.marker.bindPopup).toHaveBeenCalled());
    const popup = leaflet.marker.bindPopup.mock.calls[0][0] as HTMLAnchorElement;
    expect(popup.textContent).toBe("<b>Flat</b>");
    expect(popup.querySelector("b")).toBeNull();
  });

  it("opens on Tbilisi when there is nothing to show", async () => {
    render(<ListingMap points={[]} label="Map" />);
    await waitFor(() => expect(leaflet.instance.setView).toHaveBeenCalledWith([41.7151, 44.8271], 12));
    expect(leaflet.instance.fitBounds).not.toHaveBeenCalled();
  });

  it("removes the map when it leaves the page", async () => {
    const { unmount } = render(<ListingMap points={points} label="Map" />);
    await waitFor(() => expect(leaflet.instance.fitBounds).toHaveBeenCalled());
    unmount();
    expect(leaflet.instance.remove).toHaveBeenCalled();
  });

  it("does not build a map if it left the page before the library loaded", async () => {
    const { unmount } = render(<ListingMap points={points} label="Map" />);
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(leaflet.api.map).not.toHaveBeenCalled();
  });
});

describe("LocationPicker", () => {
  const ready = async () => {
    const view = render(
      <form aria-label="f">
        <LocationPicker label="Pin" />
      </form>,
    );
    await waitFor(() => expect(leaflet.instance.on).toHaveBeenCalled());
    return view;
  };

  it("adds no location until the map is clicked", async () => {
    const { container } = await ready();
    expect(container.querySelector("input[name=lat]")).toBeNull();
  });

  it("stores the clicked point in hidden fields and moves the pin", async () => {
    const { container } = await ready();
    const latlng = { lat: 41.123456789, lng: 44.5 };
    act(() => leaflet.instance.on.mock.calls[0][1]({ latlng }));
    expect(container.querySelector("input[name=lat]")).toHaveValue("41.123457");
    expect(container.querySelector("input[name=lng]")).toHaveValue("44.500000");
    expect(leaflet.marker.setLatLng).toHaveBeenCalledWith(latlng);
  });

  it("cleans up, and skips setup if unmounted early", async () => {
    const first = await ready();
    first.unmount();
    expect(leaflet.instance.remove).toHaveBeenCalled();
    vi.clearAllMocks();
    const second = render(<LocationPicker label="Pin" />);
    second.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(leaflet.api.map).not.toHaveBeenCalled();
  });
});
