"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/hooks";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Alias kept for callers that describe the dialog body. */
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ open, title, subtitle, description, onClose, children, footer, size = "md" }: ModalProps) {
  const caption = subtitle ?? description;
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className={`modal ${size === "lg" ? "lg" : size === "sm" ? "sm" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {caption ? <div className="card-subtitle">{caption}</div> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
