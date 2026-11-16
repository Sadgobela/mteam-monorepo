"use client";

import { useEffect, useTransition, type FormEvent, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { App, Button, Input } from "antd";
import { MAX_MESSAGE, type Dict } from "@mteam/shared";

/**
 * A message box. `children` are the form's hidden fields. The action answers with a redirect (to the chat, or back with
 * a note when the message was refused); if it cannot be reached at all, a toast says so and the message stays in the box.
 */
export function ChatForm({ action, t, placeholder, children }: { action: (form: FormData) => Promise<void>; t: Dict; placeholder: string; children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const { message } = App.useApp();
  // Sent by hand rather than through the form's action, which would empty the box even when sending failed.
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await action(form);
      } catch (error) {
        unstable_rethrow(error);
        message.error(t.chat.failed);
      }
    });
  };
  return (
    <form onSubmit={send} className="chat-form">
      {children}
      <Input.TextArea name="body" required maxLength={MAX_MESSAGE} autoSize={{ minRows: 2, maxRows: 6 }} aria-label={placeholder} placeholder={placeholder} />
      <Button type="primary" htmlType="submit" disabled={pending} aria-busy={pending || undefined}>
        {t.chat.send}
      </Button>
    </form>
  );
}

const REFRESH_MS = 15_000;

/** ponytail: new messages appear by re-reading the page. Use a live connection if chats get busy. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    // Reading a chat marks it read, so a tab nobody is looking at must not.
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
