import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@mteam/shared";

vi.mock("@mteam/db", () => ({}));
vi.mock("@/lib/session", () => ({ hasSession: async () => false }));
vi.mock("@/lib/auth-actions", () => ({ logoutAction: vi.fn() }));

import MortgagePage, { generateMetadata } from "./[locale]/mortgage/page";

const t = getDictionary("en");
const params = Promise.resolve({ locale: "en" });

describe("MortgagePage", () => {
  it("offers the calculator on a typical price", async () => {
    render(await MortgagePage({ params }));
    expect(screen.getByRole("heading", { level: 1, name: t.nav.mortgage })).toBeInTheDocument();
    expect(screen.getByDisplayValue("100000")).toBeInTheDocument();
  });

  it("has its own title and address", async () => {
    expect(await generateMetadata({ params })).toMatchObject({ title: t.nav.mortgage, alternates: { canonical: "/en/mortgage" } });
  });
});
