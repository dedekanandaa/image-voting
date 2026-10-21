const COLORS = ["#fb7185", "#fbbf24", "#22d3ee", "#a78bfa", "#34d399", "#f472b6"];
const SHAPES = ["rounded-sm", "rounded-full", "rounded-none"];

// Index-based pieces: deterministic markup so SSR and client match.
// Pieces fan out from the center in a ring, then fall.
const PIECES = Array.from({ length: 160 }, (_, index) => {
  const size = 5 + (index % 5) * 2;
  const angle = (index / 160) * Math.PI * 2 + ((index * 7) % 5) * 0.08;
  const distance = 180 + ((index * 53) % 190);
  return {
    backgroundColor: COLORS[index % COLORS.length],
    animationDelay: `${(index % 7) * 30}ms`,
    animationDuration: `${2.6 + (index % 5) * 0.25}s`,
    width: index % 3 === 0 ? size * 1.6 : size,
    height: size,
    shape: SHAPES[index % SHAPES.length],
    "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
    "--dy": `${Math.round(Math.sin(angle) * distance)}px`,
  };
});

export function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] hidden overflow-hidden motion-safe:block">
      {PIECES.map(({ shape, ...style }, index) => (
        <span
          key={index}
          style={style as React.CSSProperties}
          className={`absolute left-1/2 top-1/2 animate-confetti-burst ${shape}`}
        />
      ))}
    </div>
  );
}
