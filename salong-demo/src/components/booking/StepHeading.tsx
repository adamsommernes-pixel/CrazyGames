"use client";

import { useEffect, useRef } from "react";

/**
 * Step title that takes focus when the step appears, so screen reader and
 * keyboard users land at the start of the new step.
 */
export function StepHeading({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="mb-8">
      <h2 ref={ref} tabIndex={-1} className="text-d3 outline-none">
        {children}
      </h2>
      {hint && <p className="mt-3 text-muted">{hint}</p>}
    </div>
  );
}
