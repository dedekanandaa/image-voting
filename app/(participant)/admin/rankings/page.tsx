"use client";

import { useEffect, useState } from "react";

type Row = { rank: number; id: string; title: string; submitter: string; votes: number; imageUrl: string };

// Monitor view: polls live rankings. Pass ?campaignId=... in URL.
export default function AdminRankingsPage() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [updated, setUpdated] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setCampaignId(new URLSearchParams(window.location.search).get("campaignId"));
  }, []);

  useEffect(() => {
    if (!campaignId) return setError("Missing campaignId in URL");
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/rankings?campaignId=${encodeURIComponent(campaignId)}`, { cache: "no-store" });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) return setError(body.error || "Failed to load");
        setRows(body.data);
        setUpdated(new Date(body.timestamp).toLocaleTimeString());
        setError("");
      } catch {
        if (alive) setError("Connection lost, retrying…");
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [campaignId]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-serif text-4xl font-semibold">Live rankings</h1>
        <span className="text-xs text-slate-500">Updated {updated || "—"}</span>
      </div>
      {error && <p role="status" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <ol className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className={`flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition-all duration-700 ease-out ${r.rank <= 3 ? "ring-2 ring-amber-300" : ""}`}
          >
            <span className="w-10 text-center font-serif text-3xl font-semibold text-blue-600">{r.rank}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl} alt="" className="h-16 w-16 flex-none rounded-xl object-cover transition-transform duration-700" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.title}</p>
              <p className="truncate text-sm text-slate-500">{r.submitter}</p>
            </div>
            <span
              key={`${r.id}-${r.votes}`}
              className="animate-[pulse-once_0.8s_ease-out] rounded-full px-2 text-2xl font-bold tabular-nums"
            >
              {r.votes}
            </span>
          </li>
        ))}
      </ol>
      <style>{`@keyframes pulse-once { 0% { transform: scale(1.4); color: #d97706; } 100% { transform: scale(1); } }`}</style>
      {!error && !rows.length && <p className="text-sm text-slate-500">No finalists yet.</p>}
    </main>
  );
}
