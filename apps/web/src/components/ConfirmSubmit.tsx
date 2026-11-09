"use client";

import { useRef } from "react";
import { Button, Popconfirm } from "antd";

/** A form's submit button that asks first, for actions that take something down. */
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
  return (
    <>
      <Popconfirm title={question} okText={yes} cancelText={no} onConfirm={() => (submit.current as HTMLButtonElement).click()}>
        <Button>{label}</Button>
      </Popconfirm>
      {/* A real submit button, so the form's own name and value are sent with it. */}
      <button ref={submit} type="submit" name={name} value={value} hidden />
    </>
  );
}
