type ClassProps = { className?: string };

function classNames(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

export function Otter({ className }: ClassProps) {
  return (
    <span
      aria-hidden
      className={classNames("inline-block animate-otter hover:animate-wiggle", className)}
    >
      🦦
    </span>
  );
}

export function RainbowRule({ className }: ClassProps) {
  return <div aria-hidden className={classNames("rainbow-rule", className)} />;
}
