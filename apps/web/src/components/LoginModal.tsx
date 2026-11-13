"use client";

import type { ReactNode } from "react";
import { Modal } from "antd";
import { useRouter } from "next/navigation";

/** Sign-in over the page it was opened from. Closing it goes back to that page. */
export function LoginModal({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Modal open centered footer={null} width={760} onCancel={() => router.back()} rootClassName="login-modal" styles={{ container: { padding: 0, overflow: "hidden" } }} aria-labelledby="login-title">
      {children}
    </Modal>
  );
}
