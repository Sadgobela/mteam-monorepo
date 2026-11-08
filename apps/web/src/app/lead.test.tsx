import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getDictionary } from "@mteam/shared";

const db = vi.hoisted(() => ({ createLead: vi.fn() }));
vi.mock("@mteam/db", () => db);

import { LeadForm } from "@/components/LeadForm";
import { leadAction } from "@/lib/lead-actions";

const t = getDictionary("en");
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => vi.resetAllMocks());

describe("leadAction", () => {
  it("saves a valid request with the normalized phone", async () => {
    expect(await leadAction({}, form({ name: " Nino ", phone: "555 12 34 56", deal: "sale" }))).toEqual({ sent: true });
    expect(db.createLead).toHaveBeenCalledWith({ name: "Nino", phone: "+995555123456", deal: "sale" });
  });

  it("rejects a bad phone without saving", async () => {
    expect(await leadAction({}, form({ name: "Nino", phone: "123", deal: "sale" }))).toEqual({ invalid: true });
    expect(db.createLead).not.toHaveBeenCalled();
  });
});

describe("LeadForm", () => {
  const fill = async (phone: string) => {
    const user = userEvent.setup();
    render(<LeadForm t={t} />);
    await user.type(screen.getByLabelText(t.home.leadName), "Nino");
    await user.type(screen.getByLabelText(t.login.phone), phone);
    await user.click(screen.getByRole("button", { name: t.home.leadSubmit }));
  };

  it("thanks the owner once sent", async () => {
    await fill("555123456");
    expect(await screen.findByRole("status")).toHaveTextContent(t.home.leadSent);
    expect(screen.queryByRole("button", { name: t.home.leadSubmit })).toBeNull();
  });

  it("explains a bad number", async () => {
    await fill("123");
    expect(await screen.findByRole("alert")).toHaveTextContent(t.login.errors.invalidPhone);
  });
});
