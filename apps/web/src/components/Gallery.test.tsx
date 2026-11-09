import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { Gallery } from "./Gallery";

const t = getDictionary("en");
const photos = (count: number) => Array.from({ length: count }, (_, index) => `https://cdn/${index + 1}.jpg`);

// jsdom has no modal dialogs.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const shown = () => screen.getByRole("dialog").querySelector(".viewer-photo img")?.getAttribute("src");

function openOn(count: number, tile = 0) {
  const view = render(<Gallery images={photos(count)} title="Flat" tone="violet" t={t} />);
  fireEvent.click(screen.getAllByRole("button")[tile]);
  return view;
}

describe("Gallery", () => {
  it("shows placeholders and no viewer without photos", () => {
    const { container } = render(<Gallery images={[]} title="Flat" tone="rose" t={t} />);
    expect(container.querySelectorAll(".ph")).toHaveLength(3);
    expect(container.querySelector(".ph.rose")).not.toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 5],
    [10, 5],
  ])("lays out %i photos as %i tiles", (count, tiles) => {
    const { container } = render(<Gallery images={photos(count)} title="Flat" tone="violet" t={t} />);
    expect(container.querySelectorAll(".gal button")).toHaveLength(tiles);
    expect(container.querySelector(".gal")).toHaveAttribute("data-tiles", String(tiles));
  });

  it("states the total on the first tile", () => {
    render(<Gallery images={photos(8)} title="Flat" tone="violet" t={t} />);
    expect(screen.getByText("8 photos")).toBeInTheDocument();
  });

  it("opens on the photo that was clicked", () => {
    openOn(3, 1);
    expect(shown()).toBe("https://cdn/2.jpg");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("steps through every photo and wraps around at both ends", () => {
    openOn(10);
    fireEvent.click(screen.getByRole("button", { name: t.gallery.previous }));
    expect(shown()).toBe("https://cdn/10.jpg");
    fireEvent.click(screen.getByRole("button", { name: t.gallery.next }));
    expect(shown()).toBe("https://cdn/1.jpg");
  });

  it("moves with the arrow keys and ignores other keys", () => {
    openOn(3);
    const viewer = screen.getByRole("dialog");
    fireEvent.keyDown(viewer, { key: "ArrowRight" });
    expect(shown()).toBe("https://cdn/2.jpg");
    fireEvent.keyDown(viewer, { key: "ArrowLeft" });
    expect(shown()).toBe("https://cdn/1.jpg");
    fireEvent.keyDown(viewer, { key: "a" });
    expect(shown()).toBe("https://cdn/1.jpg");
  });

  it("moves on a swipe in either direction, and not on a small drag", () => {
    openOn(3);
    const viewer = screen.getByRole("dialog");
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(viewer, { touches: [{ clientX: from }] });
      fireEvent.touchEnd(viewer, { changedTouches: [{ clientX: to }] });
    };
    swipe(300, 100);
    expect(shown()).toBe("https://cdn/2.jpg");
    swipe(100, 300);
    expect(shown()).toBe("https://cdn/1.jpg");
    swipe(100, 120);
    expect(shown()).toBe("https://cdn/1.jpg");
  });

  it("offers no arrows for a single photo", () => {
    openOn(1);
    expect(shown()).toBe("https://cdn/1.jpg");
    expect(screen.queryByRole("button", { name: t.gallery.next })).toBeNull();
    expect(screen.queryByText(/photos/)).toBeNull();
  });

  it("closes and stops showing the photo", () => {
    const { container } = openOn(2);
    fireEvent.click(screen.getByRole("button", { name: t.gallery.close }));
    const viewer = container.querySelector("dialog") as HTMLDialogElement;
    expect(viewer).not.toHaveAttribute("open");
    expect(viewer.querySelector("img")).toBeNull();
  });
});
