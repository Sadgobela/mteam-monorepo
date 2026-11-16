"use client";

import { useRef } from "react";
import { Button, Popconfirm } from "antd";
import { useFormBusy } from "./SubmitButton";

/**
 * A form's submit button that asks first, for actions that take something down. It spins while the form is sent; put it
 * in an `ActionForm`, since the popover's own re-renders reset React's form status.
 */
export function ConfirmSubmit({
  label,
  question,
  yes,
  no,
  name,
  value,
}: {
  label: string;
  question: string;
  yes: string;
  no: string;
  name?: string;
  value?: string;
}) {
  const submit = useRef<HTMLButtonElement>(null);
  const busy = useFormBusy();
  return (
    <>
      <Popconfirm title={question} okText={yes} cancelText={no} onConfirm={() => (submit.current as HTMLButtonElement).click()}>
        <Button disabled={busy} aria-busy={busy || undefined}>
          {label}
        </Button>
      </Popconfirm>
      {/* A real submit button, so the form's own name and value are sent with it. */}
      <button ref={submit} type="submit" name={name} value={value} hidden />
    </>
  );
}
