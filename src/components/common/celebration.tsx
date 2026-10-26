import type { CSSProperties } from "react";

const PIECES = 14;
const COLORS = ["bg-whimsy-from", "bg-whimsy-via", "bg-whimsy-to"];

export function Celebration() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: PIECES }, (_, index) => (
        <span
          key={index}
          className={`absolute top-1/2 left-1/2 size-1.5 animate-confetti rounded-full ${COLORS[index % COLORS.length]}`}
          style={{ "--angle": `${(360 / PIECES) * index}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}
