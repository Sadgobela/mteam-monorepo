import { Component, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "antd";
import { redirect } from "next/navigation";
import { getDictionary } from "@mteam/shared";

import { ActionForm } from "./ActionForm";
import { ChatForm } from "./ChatForm";
import { SubmitButton } from "./SubmitButton";

const t = getDictionary("en");

/** Where a redirect from an action ends up, as with Next's own redirect boundary. */
class Boundary extends Component<{ children: ReactNode }, { caught?: string }> {
  state: { caught?: string } = {};
  static getDerivedStateFromError(error: { digest?: string }) {
    return { caught: error.digest };
  }
  render() {
    return this.state.caught ? <p>caught {this.state.caught.split(";")[0]}</p> : this.props.children;
  }
}

// React reports what a boundary caught; that is expected here.
const toRedirect = async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  return redirect("/en/login");
};

/** An action that waits until the test lets it finish with the given outcome. */
function held<T>() {
  let settle: (outcome: { value?: T; error?: unknown }) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => (settle = ({ value, error }) => (error ? reject(error) : resolve(value as T))));
  return { action: vi.fn((form: FormData) => (void form, promise)), settle };
}

beforeEach(() => vi.resetAllMocks());

describe("ActionForm", () => {
  const form = (action: (form: FormData) => Promise<unknown>, done?: string) =>
    render(
      <App>
        <Boundary>
          <ActionForm action={action} done={done} failed="It failed">
            <SubmitButton>Go</SubmitButton>
          </ActionForm>
        </Boundary>
      </App>,
    );

  it("says it worked once the action is done", async () => {
    const { action, settle } = held<void>();
    form(action, "It worked");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Go" })).toBeDisabled());
    expect(screen.queryByText("It worked")).toBeNull();
    await act(async () => settle({}));
    expect(await screen.findByText("It worked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeEnabled();
  });

  it("says nothing on success when there is nothing to say", async () => {
    const action = vi.fn(async () => undefined);
    form(action);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Go" })).toBeEnabled());
    expect(document.querySelector(".ant-message")).toBeNull();
  });

  it("reads a refusal as a failure", async () => {
    form(async () => false, "It worked");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(await screen.findByText("It failed")).toBeInTheDocument();
    expect(screen.queryByText("It worked")).toBeNull();
  });

  it("shows a thrown error as a note instead of the error page", async () => {
    form(async () => Promise.reject(new Error("database gone")), "It worked");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(await screen.findByText("It failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("leaves a redirect to Next", async () => {
    form(toRedirect, "It worked");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(await screen.findByText("caught NEXT_REDIRECT")).toBeInTheDocument();
    expect(screen.queryByText("It worked")).toBeNull();
    expect(screen.queryByText("It failed")).toBeNull();
  });
});

describe("ChatForm", () => {
  const chat = (action: (form: FormData) => Promise<void>) =>
    render(
      <App>
        <Boundary>
          <ChatForm action={action} t={t} placeholder="Message">
            <input type="hidden" name="conversationId" value="c1" />
          </ChatForm>
        </Boundary>
      </App>,
    );
  const write = (text: string) => fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: text } });

  it("sends the message with the hidden fields and is busy meanwhile", async () => {
    const { action, settle } = held<void>();
    chat(action);
    write("Hello");
    fireEvent.click(screen.getByRole("button", { name: t.chat.send }));
    await waitFor(() => expect(screen.getByRole("button", { name: t.chat.send })).toBeDisabled());
    expect(screen.getByRole("button", { name: t.chat.send })).toHaveAttribute("aria-busy", "true");
    const sent = action.mock.calls[0][0];
    expect([sent.get("conversationId"), sent.get("body")]).toEqual(["c1", "Hello"]);
    await act(async () => settle({}));
    await waitFor(() => expect(screen.getByRole("button", { name: t.chat.send })).toBeEnabled());
  });

  it("keeps the message and says so when it cannot be sent", async () => {
    chat(async () => Promise.reject(new Error("offline")));
    write("Hello");
    fireEvent.click(screen.getByRole("button", { name: t.chat.send }));
    expect(await screen.findByText(t.chat.failed)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Hello");
  });

  it("follows the redirect to the conversation", async () => {
    chat(toRedirect);
    write("Hello");
    fireEvent.click(screen.getByRole("button", { name: t.chat.send }));
    expect(await screen.findByText("caught NEXT_REDIRECT")).toBeInTheDocument();
  });
});
