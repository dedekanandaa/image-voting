"use client";

import { useEffect, useRef, useState } from "react";

type Row = { rank: number; id: string; title: string; submitter: string; votes: number; imageUrl: string };

// Reveal view: fetches rankings once. Pass ?campaignId=... in URL.
const COLORS = ["#f43f5e", "#8b5cf6", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"];

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 220 }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 10,
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y > canvas.height && now - start < 5000) p.y = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (now - start < 9000) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50" aria-hidden />;
}

// Visual order on the podium: 2nd, 1st, 3rd.
const SLOTS = [
  { rank: 2, height: "h-40 sm:h-52", medal: "🥈", bg: "bg-slate-300", delay: "0.6s" },
  { rank: 1, height: "h-56 sm:h-72", medal: "🥇", bg: "bg-amber-400", delay: "1.2s" },
  { rank: 3, height: "h-28 sm:h-36", medal: "🥉", bg: "bg-orange-300", delay: "0s" },
];

export default function AdminRankingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const campaignId = new URLSearchParams(window.location.search).get("campaignId");
    if (!campaignId) return setError("Missing campaignId in URL");
    fetch(`/api/admin/rankings?campaignId=${encodeURIComponent(campaignId)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load");
        setRows(body.data);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      setCount(null);
      setRevealed(true);
      return;
    }
    const id = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(id);
  }, [count]);

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-4xl flex-col px-4 py-8 sm:py-12">
      <h1 className="text-center font-serif text-4xl font-semibold">Winners</h1>
      {error && <p role="status" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!revealed && count === null && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-6xl">🏆</p>
          <p className="text-slate-600">The winners are ready to be revealed.</p>
          <button
            onClick={() => setCount(3)}
            disabled={!loaded || !rows.length}
            className="rounded-full bg-rose-500 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-rose-500/40 transition active:scale-95 disabled:opacity-50"
          >
            Reveal winner
          </button>
          {loaded && !rows.length && <p className="text-sm text-slate-500">No finalists yet.</p>}
        </div>
      )}

      {count !== null && (
        <div className="flex flex-1 items-center justify-center">
          <span key={count} className="animate-[count-pop_1s_ease-out] font-serif text-[10rem] font-bold leading-none text-rose-500">{count}</span>
        </div>
      )}

      {revealed && (
        <>
          <Confetti />
          <div className="mt-10 flex flex-1 items-end justify-center gap-2 sm:gap-4">
            {SLOTS.map((slot) => {
              const row = rows.find((r) => r.rank === slot.rank);
              if (!row) return <div key={slot.rank} className="w-1/3" />;
              return (
                <div key={slot.rank} className="flex w-1/3 animate-[rise_0.8s_ease-out_both] flex-col items-center" style={{ animationDelay: slot.delay }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.imageUrl} alt={row.title} className={`mb-3 aspect-[3/4] w-full rounded-2xl object-cover shadow-lg ${slot.rank === 1 ? "ring-4 ring-amber-400" : ""}`} />
                  <p className="w-full truncate text-center font-semibold">{row.title}</p>
                  <p className="w-full truncate text-center text-sm text-slate-500">{row.submitter}</p>
                  <div className={`mt-3 flex w-full flex-col items-center justify-start rounded-t-2xl pt-3 ${slot.height} ${slot.bg}`}>
                    <span className="text-4xl">{slot.medal}</span>
                    <span className="mt-1 font-serif text-3xl font-bold text-slate-800">{row.rank}</span>
                    <span className="text-sm font-semibold text-slate-700">{row.votes} votes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <style>{`
        @keyframes count-pop { 0% { transform: scale(0.4); opacity: 0; } 30% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.9; } }
        @keyframes rise { 0% { transform: translateY(60px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      `}</style>
    </main>
  );
}
