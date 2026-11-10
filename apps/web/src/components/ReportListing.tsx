"use client";

import { useActionState, useState } from "react";
import { Button, Modal } from "antd";
import { reportReasons, type Dict } from "@mteam/shared";
import { reportListingAction } from "@/lib/report-actions";
import { FormSelect } from "./FormSelect";

export function ReportListing({ listingId, t }: { listingId: number; t: Dict }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reportListingAction, {});
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t.listing.report}</Button>
      <Modal open={open} title={t.listing.report} footer={null} onCancel={() => setOpen(false)}>
        {state.sent ? (
          <p role="status">{t.listing.reportThanks}</p>
        ) : (
          <form className="form" action={action}>
            <input type="hidden" name="listingId" value={listingId} />
            <FormSelect name="reason" label={t.listing.reportReason} options={reportReasons.map((reason) => ({ value: reason, label: t.listing.reportReasons[reason] }))} />
            <label className="field">
              <small>{t.listing.reportNote}</small>
              <textarea name="note" rows={3} maxLength={500} />
            </label>
            {state.invalid && <p className="note" role="alert">{t.listing.reportInvalid}</p>}
            <button className="btn" type="submit" disabled={pending}>{t.listing.reportSend}</button>
          </form>
        )}
      </Modal>
    </>
  );
}
