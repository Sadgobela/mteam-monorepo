import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Thumbnail } from "./Thumbnail";

const stored = "https://cdn.test/listings/0f8fad5b-d9cb-469f-a165-70867728950e.webp";

describe("Thumbnail", () => {
  it("shows the small copy of one of our photos, and the photo itself if the copy is missing", () => {
    render(<Thumbnail src={stored} alt="Flat" />);
    const image = screen.getByRole("img", { name: "Flat" });
    expect(image).toHaveAttribute("src", stored.replace(".webp", "_thumb.webp"));
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", stored);
  });

  it("shows a photo from elsewhere as it is", () => {
    render(<Thumbnail src="https://other.test/a.jpg" alt="Flat" />);
    expect(screen.getByRole("img", { name: "Flat" })).toHaveAttribute("src", "https://other.test/a.jpg");
  });
});
