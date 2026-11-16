import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActionForm } from "./ActionForm";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { SubmitButton } from "./SubmitButton";

/** An action that waits until the test lets it finish. */
function held() {
  let finish = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  return { action: () => done, finish };
}

describe("SubmitButton", () => {
  it("is disabled and busy while its form is sent, under the same name, then ready again", async () => {
    const { action, finish } = held();
    render(
      <form action={action}>
        <SubmitButton>Save</SubmitButton>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("btn");
    expect(button).not.toHaveAttribute("aria-busy");
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBe(button);
    await act(async () => finish());
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("takes its pending state from a form submitted by hand, and its own class and disabled state", () => {
    const { rerender } = render(<SubmitButton pending className="fav" disabled={false}>Send</SubmitButton>);
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toHaveClass("fav");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    rerender(<SubmitButton pending={false} disabled>Send</SubmitButton>);
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });
});

describe("ActionForm", () => {
  it("keeps a confirmed button busy until the action is done, though the popover re-renders meanwhile", async () => {
    const { action, finish } = held();
    const sent = vi.fn<(form: FormData) => Promise<void>>(() => action());
    render(
      <ActionForm action={sent} className="row">
        <input type="hidden" name="id" value="7" />
        <ConfirmSubmit label="Archive" question="Sure?" yes="Yes" no="No" />
      </ActionForm>,
    );
    expect(document.querySelector("form")).toHaveClass("row");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    const archive = screen.getByRole("button", { name: "Archive" });
    await waitFor(() => expect(archive).toBeDisabled());
    expect(archive).toHaveAttribute("aria-busy", "true");
    expect(sent.mock.calls[0][0].get("id")).toBe("7");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(archive).toBeDisabled();
    await act(async () => finish());
    await waitFor(() => expect(archive).toBeEnabled());
    expect(archive).not.toHaveAttribute("aria-busy");
  });
});
