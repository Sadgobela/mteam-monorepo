"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "antd";
import { MAX_MESSAGE, type Dict } from "@mteam/shared";

/** A message box. `children` are the form's hidden fields. */
export function ChatForm({ action, t, placeholder, children }: { action: (form: FormData) => Promise<void>; t: Dict; placeholder: string; children: ReactNode }) {
  return (
    <form action={action} className="chat-form">
      {children}
      <Input.TextArea name="body" required maxLength={MAX_MESSAGE} autoSize={{ minRows: 2, maxRows: 6 }} aria-label={placeholder} placeholder={placeholder} />
      <Button type="primary" htmlType="submit">{t.chat.send}</Button>
    </form>
  );
}

const REFRESH_MS = 15_000;

/** ponytail: new messages appear by re-reading the page. Use a live connection if chats get busy. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
