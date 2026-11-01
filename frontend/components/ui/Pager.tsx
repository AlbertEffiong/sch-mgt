"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        Page {page} of {totalPages} · {total} record{total === 1 ? "" : "s"}
      </span>
      <div>
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronLeft size={15} />}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
