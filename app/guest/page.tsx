"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

export default function GuestPage() {
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"register" | "login">("register");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, name: String(form.get("name") || ""), email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Registration failed");
        }
      }
      const result = await signIn("guest", { email, password, redirect: false });
      if (result?.error) throw new Error("Email or password is wrong");
      window.location.href = "/submit";
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="font-serif text-2xl font-semibold">{mode === "register" ? "Create guest account" : "Guest sign in"}</h1>
        {mode === "register" && (
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-bold text-slate-700">Name</label>
            <input id="name" name="name" required maxLength={100} className={input} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-xs font-bold text-slate-700">Email</label>
          <input id="email" name="email" type="email" required className={input} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-xs font-bold text-slate-700">Password</label>
          <input id="password" name="password" type="password" required minLength={8} className={input} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy || (mode === "register" && !token)} className="w-full rounded-full bg-rose-500 px-5 py-3 font-bold text-white disabled:opacity-50">
          {busy ? "Please wait…" : mode === "register" ? "Register" : "Sign in"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }} className="w-full text-sm font-semibold text-slate-500">
          {mode === "register" ? "Already registered? Sign in" : "New guest? Register"}
        </button>
      </form>
    </div>
  );
}
