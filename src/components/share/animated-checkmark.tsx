export function AnimatedCheckmark({ color = "#22c55e" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={80}
      height={80}
      className="mx-auto"
      style={{
        filter: `drop-shadow(0 0 0px ${color})`,
        animation: "checkGlow 1s ease-out 1s forwards",
      }}
    >
      <style>{`
        @keyframes checkGlow {
          from { filter: drop-shadow(0 0 0px ${color}); }
          to { filter: drop-shadow(0 0 14px ${color}); }
        }
      `}</style>
      <circle
        cx={40}
        cy={40}
        r={36}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={226}
        strokeLinecap="round"
        className="draw-circle"
      />
      <path
        d="M20 40 L34 54 L60 28"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={60}
        className="draw-check"
      />
    </svg>
  );
}
