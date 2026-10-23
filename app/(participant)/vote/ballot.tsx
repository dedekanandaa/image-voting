"use client";

import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Confetti } from "@/components/confetti";

type Campaign = { id: string; name: string };
type Submission = { id: string; title: string; imageUrl: string; isOwn?: boolean };
type UserVote = { id: string; title: string; imageUrl: string; rank: number };

const MAX_SELECTIONS = 5;

export function Ballot() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);

  useEffect(() => {
    fetch("/api/votes").then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error || "Unable to load ballot");
      return response.json();
    }).then((data: { campaign: Campaign | null; submissions: Submission[]; hasVoted?: boolean; userVotes?: UserVote[] }) => {
      setCampaign(data.campaign);
      setSubmissions(data.submissions);
      if (data.hasVoted) {
        setSubmitted(true);
        setUserVotes(data.userVotes ?? []);
        setMessage("You have already voted.");
      }
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  function toggleSelection(id: string) {
    const submission = submissions.find((s) => s.id === id);
    if (submission?.isOwn) {
      setMessage("You can't vote for your own images.");
      return;
    }
    if (!selected.has(id) && selected.size >= MAX_SELECTIONS) {
      setMessage(`You already selected ${MAX_SELECTIONS} images. Click a selected image to deselect it first.`);
      return;
    }
    setMessage("");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!campaign) return;
    setLoading(true);
    const response = await fetch("/api/votes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id, votes: Array.from(selected).map((submissionId, idx) => ({ submissionId, rank: idx + 1 })) }),
    });
    setLoading(false);
    if (!response.ok) return setMessage((await response.json()).error || "Vote failed.");
    setSubmitted(true);
    setMessage("Your ballot has been submitted.");
  }

  function closeConfirm() {
    setShowConfirm(false);
  }

  function cancelConfirm() {
    setShowConfirm(false);
    if (selected.size < MAX_SELECTIONS) setMessage(`Please select ${MAX_SELECTIONS} images.`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-8 sm:pt-12">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">Community vote</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">Choose your favorites</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Select exactly 5 photos you love most.</p>
      {loading && !campaign && <p className="mt-10 text-sm text-slate-500">Preparing your ballot…</p>}
      {!loading && !submissions.length && <div className="mt-10 rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">No finalists are ready yet.</div>}

      {submitted && userVotes.length > 0 && (
        <section className="mt-6 rounded-2xl bg-emerald-50 p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">Your vote ({userVotes.length}/{MAX_SELECTIONS})</h2>
          <div className="mt-3 flex -mx-2 gap-2 overflow-x-auto px-2 pb-2 sm:-mx-4 sm:gap-3 sm:px-4">
            {userVotes.map((v) => (
              <div key={v.id} className="relative shrink-0 rounded-xl shadow-sm">
                <img src={v.imageUrl} alt={v.title} className="h-24 w-16 rounded-xl object-cover sm:h-32 sm:w-24" />
                <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow">{v.rank}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {!submitted && selected.size > 0 && (
        <section className="mt-6 rounded-2xl bg-rose-50 p-4 shadow-sm sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-700">Your picks ({selected.size}/{MAX_SELECTIONS})</h2>
          <div className="mt-3 flex -mx-2 gap-2 overflow-x-auto px-2 pb-2 sm:-mx-4 sm:gap-3 sm:px-4">
            {submissions.filter((s) => selected.has(s.id)).map((s) => (
              <button key={s.id} onClick={() => toggleSelection(s.id)} className="group relative shrink-0 rounded-xl shadow-sm transition active:scale-95">
                <img src={s.imageUrl} alt={s.title} className="h-24 w-16 rounded-xl object-cover sm:h-32 sm:w-24" />
                <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow">✕</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{submissions.length} finalists</p>
        <div className="flex gap-1 rounded-full bg-rose-50 p-1" role="group" aria-label="View mode">
          <button onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${viewMode === "list" ? "bg-rose-500 text-white shadow-md" : "text-slate-600 hover:text-slate-800"}`}>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" /></svg>
            List
          </button>
          <button onClick={() => setViewMode("grid")} aria-pressed={viewMode === "grid"} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${viewMode === "grid" ? "bg-rose-500 text-white shadow-md" : "text-slate-600 hover:text-slate-800"}`}>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM13 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" /></svg>
            Grid
          </button>
        </div>
      </div>

      <div className={`mt-6 ${viewMode === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-5" : "space-y-3 sm:space-y-4"}`}>
        {submissions.map((submission, index) => (
          <button
            key={submission.id}
            type="button"
            onClick={() => setPreviewIndex(index)}
            aria-label={`Preview finalist ${index + 1}${selected.has(submission.id) ? ", selected" : ""}`}
            className={`group flex w-full overflow-hidden bg-white text-left shadow-sm transition active:scale-[0.98] ${viewMode === "grid" ? "flex-col rounded-2xl" : "items-center gap-4 rounded-2xl p-2 pr-4"} ${selected.has(submission.id) ? "ring-2 ring-rose-400" : ""}`}
          >
            <div className={`relative shrink-0 ${viewMode === "grid" ? "" : "w-24 overflow-hidden rounded-xl sm:w-32"}`}>
              <img src={submission.imageUrl} alt="" className={`aspect-[3/4] w-full object-cover ${viewMode === "grid" ? "" : "rounded-xl"}`} />
              {selected.has(submission.id) && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white shadow">✓</span>}
            </div>
            <div className={`min-w-0 flex-1 ${viewMode === "grid" ? "p-3" : ""}`}>
              <h2 className="truncate font-serif text-base font-semibold sm:text-lg">{submission.title}</h2>
              <p className={`text-xs font-semibold ${submission.isOwn ? "text-slate-400" : selected.has(submission.id) ? "text-rose-600" : "text-slate-400"}`}>{submission.isOwn ? "Your photo" : selected.has(submission.id) ? "Selected" : "Tap to preview"}</p>
            </div>
          </button>
        ))}
      </div>

      {previewIndex !== null && (
        <Preview
          submissions={submissions}
          startIndex={previewIndex}
          selected={selected}
          maxSelections={MAX_SELECTIONS}
          onToggle={toggleSelection}
          onClose={() => setPreviewIndex(null)}
        />
      )}

      {showConfirm && (
        <ConfirmModal
          submissions={submissions.filter((s) => selected.has(s.id))}
          loading={loading}
          submitted={submitted}
          error={submitted ? "" : message}
          onCancel={cancelConfirm}
          onConfirm={submit}
          onDone={closeConfirm}
        />
      )}

      {(submissions.length > 0 || message) && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rose-100 bg-[#fffaf5]/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4"><p role="status" className={`min-w-0 flex-1 text-sm ${submitted ? "font-bold text-emerald-600" : message ? "text-red-600" : "text-slate-500"}`}>{message || `${selected.size} of ${MAX_SELECTIONS} selected`}</p><button disabled={loading || selected.size !== MAX_SELECTIONS || submitted} onClick={() => setShowConfirm(true)} className="rounded-full bg-rose-500 px-6 py-3 font-bold text-white shadow-lg shadow-rose-200 disabled:opacity-50">{loading ? "Submitting…" : submitted ? "Vote submitted" : "Submit vote"}</button></div>
      </div>}
    </main>
  );
}

// Auto-scrolling review of picks. Pauses while the user touches or hovers.
function ReviewCarousel({ submissions }: { submissions: Submission[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resumeScroll = () => {
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setPaused(false);
      pauseTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    if (paused) return;
    let frame = 0;
    const container = containerRef.current;
    if (!container) return;
    const halfWidth = container.scrollWidth / 2;
    const step = () => {
      // Whole-pixel steps: fractional scrollLeft writes get truncated and stall.
      container.scrollLeft += 1;
      if (container.scrollLeft >= halfWidth - 10) container.scrollLeft = 0;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [paused]);

  const cards = [...submissions, ...submissions];
  return (
    <div
      ref={containerRef}
      className="overflow-x-auto px-6 py-6 sm:px-8"
      style={{ scrollbarWidth: "none" }}
      onWheel={() => {
        setPaused(true);
        resumeScroll();
      }}
      onTouchMove={() => {
        setPaused(true);
        resumeScroll();
      }}
    >
      <div className="flex w-max gap-4">
        {cards.map((submission, index) => (
          <div key={`${submission.id}-${index}`} className="w-[70vw] max-w-xs shrink-0 sm:w-72">
            <div className="overflow-hidden rounded-2xl bg-rose-50 shadow-md">
              <img src={submission.imageUrl} alt={submission.title} className="aspect-[3/4] w-full object-cover" />
              <p className="truncate px-3 py-2 text-sm font-bold text-slate-700 sm:text-base">{submission.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmModal({
  submissions,
  loading,
  submitted,
  error,
  onCancel,
  onConfirm,
  onDone,
}: {
  submissions: Submission[];
  loading: boolean;
  submitted: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDone: () => void;
}) {
  if (submitted) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
        <Confetti />
        <div className="animate-scale-in w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <svg viewBox="0 0 24 24" className="h-11 w-11 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 13l4 4L19 7" className="animate-draw-check" strokeDasharray={24} />
            </svg>
          </div>
          <h2 className="mt-5 font-serif text-3xl font-semibold">Vote submitted!</h2>
          <p className="mt-2 text-sm text-slate-600">Thanks for voting. Your 5 favorites are in.</p>
          <button onClick={onDone} className="mt-6 w-full rounded-full bg-rose-500 px-4 py-3 font-bold text-white shadow-lg shadow-rose-200 active:scale-95">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 sm:p-0">
      <div className="animate-scale-in flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 p-6">
          <h2 className="font-serif text-2xl font-semibold">Your 5 picks</h2>
          <p className="mt-1 text-sm text-slate-600">Review before you submit. You can't change it later.</p>
        </div>

        {/* Carousel */}
        <ReviewCarousel submissions={submissions} />

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 p-6">
          {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={loading} className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 font-bold hover:bg-slate-50 disabled:opacity-50 active:scale-95">Back</button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 rounded-full bg-rose-500 px-4 py-3 font-bold text-white shadow-lg shadow-rose-200 hover:bg-rose-600 disabled:opacity-50 active:scale-95">{loading ? "Submitting…" : "Confirm"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Preview({
  submissions,
  startIndex,
  selected,
  maxSelections,
  onToggle,
  onClose,
}: {
  submissions: Submission[];
  startIndex: number;
  selected: Set<string>;
  maxSelections: number;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ startIndex, align: "center" });
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const submission = submissions[index];
  const isSelected = selected.has(submission.id);
  const isOwn = submission.isOwn;
  const full = !isSelected && selected.size >= maxSelections;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3 text-sm font-bold text-white/80">
        <span className="min-w-0 truncate pr-3">{submissions[index].title}</span>
        <span className="shrink-0">{index + 1} of {submissions.length}</span>
        <button onClick={onClose} aria-label="Close preview" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white active:scale-95">✕</button>
      </div>

      <div ref={emblaRef} className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {submissions.map((item, i) => (
            <div key={item.id} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-4 sm:p-8">
              <img src={item.imageUrl} alt={`Finalist ${i + 1}`} className="max-h-full w-full max-w-sm rounded-2xl object-cover aspect-[3/4]" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-white/10 bg-black/60 p-4 backdrop-blur sm:space-y-4 sm:p-6">
        {isOwn && <p className="text-center text-sm font-bold text-white/70">Your photo • Can't vote</p>}
        {isSelected && !isOwn && <p className="text-center text-sm font-bold text-rose-400">✓ Selected</p>}
        <div className="flex gap-2 sm:gap-3">
          <button onClick={() => emblaApi?.scrollPrev()} disabled={index === 0} className="flex-1 rounded-full bg-white/15 px-3 py-3 font-bold text-white transition disabled:opacity-30 active:scale-95">← Prev</button>
          <button onClick={() => onToggle(submission.id)} disabled={isOwn || full} className={`flex-1 rounded-full px-3 py-3 font-bold text-white transition disabled:opacity-50 active:scale-95 ${isOwn ? "bg-slate-600" : isSelected ? "bg-slate-700" : "bg-rose-500 shadow-lg shadow-rose-500/50"}`}>
            {isOwn ? "Your photo" : isSelected ? "✓ Deselect" : full ? "Limit reached" : "Select"}
          </button>
          <button onClick={() => emblaApi?.scrollNext()} disabled={index === submissions.length - 1} className="flex-1 rounded-full bg-white/15 px-3 py-3 font-bold text-white transition disabled:opacity-30 active:scale-95">Next →</button>
        </div>
        {full && <p className="text-center text-xs font-semibold text-white/70 sm:text-sm">Deselect one first ({selected.size}/{maxSelections} selected)</p>}
      </div>
    </div>
  );
}
