"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function GuestPage() {
  const { status } = useSession();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      window.location.replace("/submit");
      return;
    }
    if (status !== "unauthenticated" || started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return setError("Invalid guest link.");

    // Validate token, set device cookie, then sign in
    fetch("/api/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "Invalid guest link" : "Setup failed");
        return signIn("guest", { token, callbackUrl: "/submit" });
      })
      .catch((err) => setError(err.message || "Could not open guest access."));
  }, [status]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className="text-slate-600">{error || "Preparing your access…"}</p>
    </div>
  );
}
