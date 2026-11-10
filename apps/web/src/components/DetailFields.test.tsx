import { describe, expect, it } from "vitest";
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
});
