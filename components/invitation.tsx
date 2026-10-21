"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

// Index-based positions keep server and client markup identical.
const SPARKLES = Array.from({ length: 16 }, (_, index) => ({
  left: `${(index * 37) % 94}%`,
  top: `${(index * 61) % 88}%`,
  animationDelay: `${(index % 6) * 300}ms`,
}));

export function Invitation({ callbackUrl, error }: { callbackUrl?: string; error?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const target = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/submit";

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#fff8f3] px-4 py-12 text-[#41251f]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#fecdd3,_transparent_40%),radial-gradient(circle_at_bottom_right,_#fde68a,_transparent_38%)]" />
      {SPARKLES.map((style, index) => (
        <span key={index} style={style} className="pointer-events-none absolute h-2 w-2 rotate-45 rounded-sm bg-rose-300/70 motion-safe:animate-float" />
      ))}

      <section className="relative m-auto w-full max-w-md text-center">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-rose-500 motion-safe:animate-fade-up">You are invited</p>
        <h1 className="font-serif text-4xl font-semibold leading-tight motion-safe:animate-fade-up sm:text-5xl">Share a moment worth remembering</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#78554d]">Open your invitation, frame your favorite photo, and join the celebration.</p>

        <div className="relative mx-auto mt-10 h-[360px] w-full max-w-[360px] [perspective:1000px]">
          <div
            inert={!open}
            className={`absolute inset-x-[7%] top-0 rounded-2xl border border-rose-100 bg-white p-6 text-left shadow-xl transition-all duration-700 motion-reduce:transition-none ${open ? "z-40 translate-y-0 opacity-100 delay-300" : "z-20 translate-y-32 opacity-0"}`}
          >
            <p className="font-serif text-2xl font-semibold">A photo celebration</p>
            <p className="mt-3 text-sm leading-6 text-[#78554d]">Pick your photo, dress it up with a special frame, and submit it for the community vote.</p>
            <button
              type="button"
              disabled={loading}
              onClick={() => { setLoading(true); signIn("keycloak", { callbackUrl: target }); }}
              className="mt-6 w-full rounded-full bg-rose-500 px-5 py-3 font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Opening sign in…" : "Login to join"}
            </button>
          </div>

          <button
            type="button"
            aria-expanded={open}
            aria-label="Open invitation"
            disabled={open}
            onClick={() => setOpen(true)}
            className={`absolute inset-x-0 bottom-0 z-30 h-48 rounded-2xl bg-rose-400 shadow-2xl shadow-rose-200 transition-transform duration-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-300 motion-reduce:transition-none ${open ? "translate-y-8" : "motion-safe:animate-wiggle hover:scale-[1.02]"}`}
          >
            <span className="absolute inset-0 rounded-2xl bg-rose-500 [clip-path:polygon(0_100%,50%_42%,100%_100%)]" />
            <span className={`absolute inset-x-0 top-0 h-3/5 origin-top bg-rose-300 transition-all duration-700 [clip-path:polygon(0_0,100%_0,50%_100%)] motion-reduce:transition-none ${open ? "opacity-0 [transform:rotateX(180deg)]" : ""}`} />
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-200 px-4 py-2 text-xs font-bold uppercase tracking-widest text-rose-700 shadow">
              {open ? "Welcome" : "Tap to open"}
            </span>
          </button>
        </div>

        {error && <p role="alert" className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Sign in failed. Please try again.</p>}
      </section>
    </main>
  );
}
