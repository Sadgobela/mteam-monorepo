import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getDictionary } from "@mteam/shared";
import { DetailFields } from "./DetailFields";

const t = getDictionary("en");

describe("DetailFields", () => {
  const hidden = (container: HTMLElement) => container.querySelector("input[name=features]") as HTMLInputElement;

  it("joins ticked features into one field, and unticks", () => {
    const { container } = render(<DetailFields locale="en" t={t} showsRooms />);
    const box = (name: string) => screen.getByText(name).closest("label")?.querySelector("input") as HTMLInputElement;
    fireEvent.click(box("Lift"));
    fireEvent.click(box("Sauna"));
    expect(hidden(container)).toHaveValue("lift|sauna");
    fireEvent.click(box("Lift"));
    expect(hidden(container)).toHaveValue("sauna");
  });

  it("asks for bedrooms only where rooms apply", () => {
    const { container, rerender } = render(<DetailFields locale="en" t={t} showsRooms />);
    expect(container.querySelector("input[name=bedrooms]")).not.toBeNull();
    rerender(<DetailFields locale="en" t={t} showsRooms={false} />);
    expect(container.querySelector("input[name=bedrooms]")).toBeNull();
    expect(container.querySelector("input[name=heating]")).not.toBeNull();
  });

  it("starts from the values of a listing being edited, and reports each change", () => {
    const changed = vi.fn();
    const { container } = render(<DetailFields locale="en" t={t} showsRooms values={{ features: "lift|sauna", ceiling: "2.8", heating: "central" }} onChange={changed} />);
    expect(hidden(container)).toHaveValue("lift|sauna");
    expect(container.querySelector("input[name=ceiling]")).toHaveValue(2.8);
    expect(container.querySelector("input[name=heating]")).toHaveValue("central");
    fireEvent.click(screen.getByText("Lift").closest("label")?.querySelector("input") as HTMLInputElement);
    expect(changed).toHaveBeenCalled();
  });
});
