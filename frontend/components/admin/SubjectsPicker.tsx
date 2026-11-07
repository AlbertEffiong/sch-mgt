"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { SUBJECT_SUGGESTIONS } from "@/lib/constants";

/**
 * Chip-style subject editor. Selected subjects are stored exactly as typed so
 * they line up with the admin curriculum used by the teacher broadsheet.
 */
export function SubjectsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (subjects: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(subject: string) {
    const clean = subject.trim();
    if (!clean) return;
    if (value.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, clean]);
    setDraft("");
  }

  function remove(subject: string) {
    onChange(value.filter((item) => item !== subject));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  const unselected = SUBJECT_SUGGESTIONS.filter(
    (subject) => !value.some((item) => item.toLowerCase() === subject.toLowerCase()),
  );

  return (
    <div className="subject-picker">
      {value.length > 0 ? (
        <div className="chip-list">
          {value.map((subject) => (
            <span key={subject} className="chip">
              {subject}
              <button type="button" onClick={() => remove(subject)} aria-label={`Remove ${subject}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a subject and press Enter"
        />
        <button type="button" className="btn btn-secondary" onClick={() => add(draft)}>
          <Plus size={15} /> Add
        </button>
      </div>

      {unselected.length > 0 ? (
        <div className="subject-suggestions">
          {unselected.slice(0, 10).map((subject) => (
            <button key={subject} type="button" onClick={() => add(subject)}>
              + {subject}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
