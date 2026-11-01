"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { readableError } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import type { School } from "@/lib/types";

interface PaymentActionModalProps {
  school: School | null;
  mode: "verify" | "reject";
  onClose: () => void;
  onDone: () => void;
}

export function PaymentActionModal({ school, mode, onClose, onDone }: PaymentActionModalProps) {
  const toast = useToast();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = school?.pendingPayment;
  const activeReference = reference || pending?.reference || "";

  async function submit() {
    if (!school) return;
    setError("");
    setBusy(true);
    try {
      if (mode === "verify") {
        await api.verifyPayment(school.id, activeReference || undefined);
        toast.push(`Payment verified for ${school.name}. Subscription renewed.`);
      } else {
        await api.rejectPayment(school.id, note.trim() || undefined);
        toast.push(`Payment rejected for ${school.name}.`);
      }
      onDone();
      onClose();
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={school !== null}
      title={mode === "verify" ? "Verify bank transfer" : "Reject bank transfer"}
      subtitle={school?.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={mode === "verify" ? "success" : "danger"} onClick={submit} loading={busy}>
            {mode === "verify" ? "Verify & renew 30 days" : "Reject payment"}
          </Button>
        </>
      }
    >
      <div className="stack">
        {error ? <div className="auth-alert">{error}</div> : null}

        <div className="bank-box" style={{ marginTop: 0 }}>
          <div>
            <span>Reference</span>
            <strong className="mono">{pending?.reference || "—"}</strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>₦{Number(pending?.amount || 0).toLocaleString()}</strong>
          </div>
          <div>
            <span>Submitted</span>
            <strong>{pending?.submittedAt ? new Date(pending.submittedAt).toLocaleDateString() : "—"}</strong>
          </div>
        </div>

        {mode === "verify" ? (
          <Field label="Payment reference" hint="Must match the reference submitted by the school.">
            <input
              className="input mono"
              value={activeReference}
              onChange={(event) => setReference(event.target.value)}
            />
          </Field>
        ) : (
          <Field label="Reason (optional)" hint="The school admin will see this note.">
            <textarea
              className="textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Transfer could not be matched to our account."
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
