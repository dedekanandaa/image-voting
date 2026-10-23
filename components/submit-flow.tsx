"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Confetti } from "./confetti";
import { FRAME_HEIGHT, FRAME_WIDTH, FRAMES, coverScale } from "@/lib/frames";

type Submission = {
  id: string;
  imageUrl: string;
  frameId: string | null;
  createdAt: string;
  isSelected: boolean;
};

type Step = "welcome" | "pick" | "edit" | "preview" | "uploading" | "done";

const STEP_LABELS = ["Choose", "Frame", "Share"];

const primaryButton = "w-full rounded-full bg-rose-500 px-5 py-3.5 font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

function Stepper({ current }: { current: number }) {
  return (
    <ol aria-label="Progress" className="mx-auto flex w-full max-w-md items-center gap-2 text-xs font-bold">
      {STEP_LABELS.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${index <= current ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-400"}`}>{index + 1}</span>
          <span className={index <= current ? "text-slate-800" : "text-slate-400"}>{label}</span>
          {index < STEP_LABELS.length - 1 && <span className="h-px flex-1 bg-rose-100" />}
        </li>
      ))}
    </ol>
  );
}

export function SubmitFlow({
  name,
  initialSubmissions,
  canSubmit,
  limit,
}: {
  name: string;
  initialSubmissions: Submission[];
  canSubmit: boolean;
  limit: number;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<HTMLImageElement | null>(null);
  const [frameId, setFrameId] = useState<(typeof FRAMES)[number]["id"]>(FRAMES[0].id);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [submissionTitle, setSubmissionTitle] = useState("");
  const [error, setError] = useState("");
  const [titleError, setTitleError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const mayUpload = canSubmit && submissions.length < limit;

  const editing = step === "edit";
  const stepIndex = step === "pick" ? 0 : editing ? 1 : 2;
  const title = step === "pick" ? "Choose your moment" : "Make it yours";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo || !frame) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#fff";
    context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    const sideways = rotation % 180 !== 0;
    const effectiveWidth = sideways ? photo.naturalHeight : photo.naturalWidth;
    const effectiveHeight = sideways ? photo.naturalWidth : photo.naturalHeight;
    const scale = coverScale(effectiveWidth, effectiveHeight, FRAME_WIDTH, FRAME_HEIGHT) * zoom;

    context.save();
    context.translate(FRAME_WIDTH / 2 + offset.x, FRAME_HEIGHT / 2 + offset.y);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(photo, -photo.naturalWidth * scale / 2, -photo.naturalHeight * scale / 2, photo.naturalWidth * scale, photo.naturalHeight * scale);
    context.restore();
    context.drawImage(frame, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  }, [frame, offset, photo, rotation, zoom]);

  // step dependency redraws when the canvas remounts after preview.
  useEffect(() => { draw(); }, [draw, step]);

  useEffect(() => {
    if (step !== "preview" || !canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
    }, "image/jpeg", 0.9);
  }, [draw, step]);

  useEffect(() => {
    const image = new Image();
    image.src = FRAMES.find((item) => item.id === frameId)!.src;
    image.decode().then(() => setFrame(image)).catch(() => setError("This frame could not be loaded."));
  }, [frameId]);

  async function choosePhoto(file?: File) {
    setError("");
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      setPhoto(image);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setStep("edit");
    } catch {
      URL.revokeObjectURL(url);
      setError("This photo cannot be opened. Please use a JPG, PNG, or WebP image.");
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const previous = pointerRef.current;
    if (!previous || previous.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = FRAME_WIDTH / rect.width;
    setOffset((current) => ({ x: current.x + (event.clientX - previous.x) * ratio, y: current.y + (event.clientY - previous.y) * ratio }));
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
  }

  function makePreview() {
    draw();
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return setError("Preview could not be created. Please try another photo.");
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ blob, url: URL.createObjectURL(blob) });
      setStep("preview");
    }, "image/jpeg", 0.9);
  }

  async function upload() {
    if (!preview) return;
    const title = submissionTitle.trim();
    if (!title) {
      setTitleError("Add a title before submitting.");
      return;
    }
    setStep("uploading");
    setError("");
    setTitleError("");
    const body = new FormData();
    body.append("file", preview.blob, "submission.jpg");
    body.append("frameId", frameId);
    body.append("title", title);
    const response = await fetch("/api/submissions", { method: "POST", body });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Upload failed. Please try again.");
      setStep("preview");
      return;
    }
    const submission: Submission = await response.json();
    setSubmissions((current) => [submission, ...current]);
    setStep("done");
  }

  function startAgain() {
    if (preview) URL.revokeObjectURL(preview.url);
    if (photo?.src.startsWith("blob:")) URL.revokeObjectURL(photo.src);
    setPreview(null);
    setPhoto(null);
    setSubmissionTitle("");
    setTitleError("");
    setError("");
    setStep("pick");
  }

  const gallery = (
    <section className="mx-auto mt-10 max-w-3xl">
      <div className="mb-4 flex items-end justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">Your gallery</p><h2 className="font-serif text-2xl font-semibold">Submitted moments</h2></div>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600">{submissions.length}/{limit}</span>
      </div>
      {submissions.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {submissions.map((submission) => (
            <article key={submission.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <img src={submission.imageUrl} alt={`Submission by ${name}`} className="aspect-[3/4] w-full object-cover" />
              <p className="px-3 py-2 text-xs font-semibold text-slate-500">{submission.isSelected ? "Selected finalist" : new Date(submission.createdAt).toLocaleDateString()}</p>
            </article>
          ))}
        </div>
      ) : <div className="rounded-2xl border border-dashed border-rose-200 bg-white/60 p-8 text-center text-sm text-slate-500">Your submitted photos will appear here.</div>}
    </section>
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      {step === "welcome" && <div className="mx-auto max-w-3xl">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-rose-500 to-orange-400 p-6 text-white shadow-xl shadow-rose-100 sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-rose-100">Welcome, {name}</p>
          <h1 className="mt-3 max-w-xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">Turn your favorite memory into something special.</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/85">Choose a photo, find the perfect frame, adjust your crop, and share it with everyone.</p>
          <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs font-bold">
            {STEP_LABELS.map((label, index) => <span key={label} className="rounded-xl bg-white/15 px-2 py-3 backdrop-blur">{index + 1}. {label}</span>)}
          </div>
          <button disabled={!mayUpload} onClick={() => setStep("pick")} className="mt-7 rounded-full bg-white px-6 py-3 font-bold text-rose-600 shadow-lg disabled:opacity-60 text-xs">
            {mayUpload ? "Choose a photo" : canSubmit ? "Submission limit reached" : "Submissions are closed"}
          </button>
        </section>
        {gallery}
      </div>}

      {step === "pick" && (
        <section className="mx-auto max-w-xl text-center">
          <div className="mb-6 flex items-center justify-between">
            <button onClick={() => setStep("welcome")} className="text-sm font-semibold text-slate-500">← Back</button>
          </div>
          <Stepper current={stepIndex} />
          <h1 className="mt-6 font-serif text-3xl font-semibold md:text-4xl">Choose your moment</h1>
          <label className="mt-8 flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-rose-200 bg-white px-6 shadow-sm transition hover:border-rose-400 hover:bg-rose-50 md:aspect-[16/10]">
            <span className="text-5xl">＋</span><span className="mt-3 font-bold">Tap to pick a photo</span><span className="mt-1 text-xs text-slate-500">JPG, PNG or WebP · up to 20MB</span>
            <input type="file" accept="image/*" onChange={(event) => choosePhoto(event.target.files?.[0])} className="sr-only" />
          </label>
          {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        </section>
      )}

      {editing && (
        <section className="mx-auto max-w-5xl">
          <div className="mb-4"><button onClick={() => setStep("pick")} className="text-sm font-semibold text-slate-500">← Back</button></div>
          <Stepper current={stepIndex} />
          <h1 className="mb-6 mt-6 text-center font-serif text-3xl font-semibold md:text-4xl">{title}</h1>

          <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-10">
            <div className="mx-auto w-full max-w-sm md:row-span-2 md:max-w-md md:justify-self-center">
              <canvas ref={canvasRef} width={FRAME_WIDTH} height={FRAME_HEIGHT} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} className="aspect-[3/4] w-full touch-none rounded-[2rem] bg-white shadow-xl" />
              <p className="mt-3 text-center text-xs text-slate-500">Drag the photo to position it.</p>
            </div>

            <div className="mt-6 space-y-6 rounded-3xl bg-white p-5 shadow-sm md:mt-0">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="zoom" className="text-sm font-bold">Zoom</label>
                  <span className="text-sm text-slate-500">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input id="zoom" type="range" min="0.5" max="2" step="0.005" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1 accent-rose-500" />
                  <button onClick={() => setRotation((current) => (current + 90) % 360)} className="shrink-0 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold">Rotate ↻</button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold">Frame</p>
                <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
                  {FRAMES.map((item) => <button key={item.id} onClick={() => setFrameId(item.id)} aria-pressed={frameId === item.id} className={`min-w-24 rounded-2xl border-2 bg-white p-2 transition md:min-w-0 ${frameId === item.id ? "border-rose-500" : "border-transparent hover:border-rose-200"}`}><img src={item.src} alt="" className="aspect-[3/4] w-full rounded-lg bg-slate-100 object-contain" /><span className="mt-1 block text-xs font-bold">{item.name}</span></button>)}
                </div>
              </div>
            </div>

            <div className="-mx-4 mt-6 border-t border-rose-100 bg-white/95 p-4 backdrop-blur md:mx-0 md:mt-0 md:border-0 md:bg-transparent md:p-0 text-sm">
              <button onClick={makePreview} disabled={!photo || !frame} className={primaryButton}>Preview photo</button>
              {error && <p role="alert" className="mt-3 text-center text-sm text-red-600">{error}</p>}
            </div>
          </div>
        </section>
      )}

      {(step === "preview" || step === "uploading" || step === "done") && (
        <>
          {step === "done" && <Confetti />}
          <div className="pointer-events-none fixed inset-0 z-40 bg-black/40" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={step === "done" ? "submission-complete-title" : "preview-title"}>
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-4 shadow-2xl motion-safe:animate-pop sm:p-6">
              <div key={step === "done" ? "done" : "preview"} className="motion-safe:animate-scale-in">
                <div className="flex flex-col items-center text-center md:gap-8">
                  <div className="max-w-[200px] sm:max-w-xs">
                    {step === "preview" ? (
                      <canvas ref={canvasRef} width={FRAME_WIDTH} height={FRAME_HEIGHT} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} aria-label="Photo preview" className="aspect-[3/4] w-full touch-none rounded-[1.5rem] bg-white shadow-lg" />
                    ) : preview && <img src={preview.url} alt="Your submitted photo" className="aspect-[3/4] w-full rounded-[1.5rem] object-cover shadow-lg" />}
                  </div>
                  {step === "preview" && (
                    <div className="w-full max-w-sm space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label htmlFor="preview-zoom" className="text-xs font-bold text-slate-700">Zoom</label>
                          <span className="text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
                        </div>
                        <input id="preview-zoom" type="range" min="0.5" max="2" step="0.005" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-rose-500" />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold text-slate-700">Frame</p>
                        <div className="flex gap-3 overflow-x-auto px-2 pb-2">
                          {FRAMES.map((item) => <button key={item.id} onClick={() => setFrameId(item.id)} aria-pressed={frameId === item.id} className={`w-20 shrink-0 rounded-lg border-2 bg-white p-1 transition ${frameId === item.id ? "border-rose-500" : "border-transparent hover:border-rose-200"}`}><img src={item.src} alt="" className="mx-auto block h-16 w-12 rounded bg-slate-100 object-contain sm:h-20 sm:w-16" /><span className="mt-1 block text-center text-xs font-bold leading-tight">{item.name}</span></button>)}
                        </div>
                      </div>
                    </div>
                  )}
                  {step === "done" ? (
                    <div className="mt-4 sm:mt-6 md:mt-0">
                      <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</span>
                      <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-rose-500">Photo submitted</p>
                      <h2 id="submission-complete-title" className="mt-2 font-serif text-2xl font-semibold sm:text-4xl">Beautiful choice, {name}!</h2>
                      <p className="mt-2 text-xs text-slate-600 sm:mt-3 sm:text-sm">Your framed photo is now part of the celebration.</p>
                      <div className="mt-4 flex flex-col justify-center gap-2 sm:mt-6 sm:gap-3 sm:flex-row">
                        <button onClick={() => setStep("welcome")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 sm:px-5 sm:py-3 sm:text-base">Back to home</button>
                        {submissions.length < limit && <button onClick={startAgain} className={`${primaryButton} px-4 py-2 sm:w-auto text-sm sm:px-5 sm:py-3`}>Upload another</button>}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 sm:mt-6 md:mt-0">
                      <h2 id="preview-title" className="font-serif text-2xl font-semibold sm:text-4xl">Ready to share?</h2>
                      <p className="mt-2 text-xs text-slate-600 sm:mt-3 sm:text-sm">Your photo looks amazing. Submit it to add to the gallery.</p>
                      <div className="mt-4 sm:mt-5">
                        <label htmlFor="submission-title" className="block text-xs font-bold text-slate-700 mb-2">Title</label>
                        <input
                          id="submission-title"
                          type="text"
                          placeholder="e.g., Golden Hour"
                          value={submissionTitle}
                          onChange={(e) => {
                            setSubmissionTitle(e.target.value.slice(0, 100));
                            setTitleError("");
                          }}
                          maxLength={100}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                        />
                        {titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
                      </div>
                      <div className="mt-4 flex flex-col justify-center gap-2 sm:mt-6 sm:gap-3 sm:flex-row">
                        <button onClick={() => setStep("edit")} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50 sm:px-5 sm:py-3 sm:text-base">Back</button>
                        <button onClick={upload} disabled={step === "uploading"} className="w-full rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-3.5 sm:text-base">
                          {step === "uploading" ? "Submitting..." : "Submit photo"}
                        </button>
                      </div>
                      {error && <p role="alert" className="mt-3 text-xs text-red-600 sm:mt-4 sm:text-sm">{error}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {step === "done" && gallery}
    </main>
  );
}
