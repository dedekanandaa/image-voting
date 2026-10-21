"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Campaign = { id: string; name: string; description: string | null; status: string; submissionStartAt: string; submissionEndAt: string; votingStartAt: string; votingEndAt: string };

const STATUSES = ["DRAFT", "SUBMISSION_OPEN", "SUBMISSION_CLOSED", "VOTING_OPEN", "VOTING_CLOSED", "PUBLISHED", "ARCHIVED"];
const label = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const EMPTY = { name: "", description: "", submissionStartAt: "", submissionEndAt: "", votingStartAt: "", votingEndAt: "" };
const fmt = (d: string) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!message?.ok) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  async function load() {
    const res = await fetch("/api/admin/campaigns");
    if (res.ok) setCampaigns(await res.json());
    else setMessage({ text: (await res.json()).error || "Unable to load campaigns", ok: false });
    setLoading(false);
  }

  // Returns an error string or "" when the date ranges make sense.
  function validate() {
    const { submissionStartAt: ss, submissionEndAt: se, votingStartAt: vs, votingEndAt: ve } = form;
    if (se <= ss) return "Submission end must be after its start.";
    if (ve <= vs) return "Voting end must be after its start.";
    if (vs < se) return "Voting should start after submissions close.";
    return "";
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validate();
    if (invalid) return setMessage({ text: invalid, ok: false });
    setSaving(true);
    const res = await fetch("/api/admin/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { setMessage({ text: "Campaign created as a draft.", ok: true }); setForm(EMPTY); load(); }
    else setMessage({ text: (await res.json()).error || "Create failed", ok: false });
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { setMessage({ text: `Status changed to ${label(status)}.`, ok: true }); load(); }
    else setMessage({ text: (await res.json()).error || "Update failed", ok: false });
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20";
  const field = (key: keyof typeof form, text: string, opts: { type?: string; required?: boolean; hint?: string; placeholder?: string; min?: string } = {}) => (
    <label className="block text-sm font-semibold text-slate-700">
      {text}{opts.required && <span className="text-red-500" aria-hidden> *</span>}
      {key === "description"
        ? <textarea rows={3} maxLength={500} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} placeholder={opts.placeholder} />
        : <input type={opts.type || "text"} required={opts.required} min={opts.min} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} placeholder={opts.placeholder} />}
      {opts.hint && <span className="mt-1 block text-xs font-normal text-slate-500">{opts.hint}</span>}
    </label>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <h1 className="mb-2 font-serif text-4xl font-semibold">Admin campaigns</h1>
      <p className="mb-8 text-sm text-slate-600">Create campaigns and change their status.</p>
      {message && (
        <p role="status" className={`mb-6 rounded-xl px-4 py-3 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}

      <form onSubmit={create} className="mb-10 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <h2 className="font-serif text-2xl font-semibold">New campaign</h2>
          <p className="mt-1 text-sm text-slate-500">Fields marked <span className="text-red-500">*</span> are required. New campaigns start as a draft.</p>
        </div>
        <div className="grid gap-4">
          {field("name", "Name", { required: true, placeholder: "e.g. Summer Party 2026" })}
          {field("description", "Description", { placeholder: "Optional — shown to participants", hint: `${form.description.length}/500` })}
        </div>
        <fieldset className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">1. Submission window</legend>
          {field("submissionStartAt", "Opens", { type: "datetime-local", required: true })}
          {field("submissionEndAt", "Closes", { type: "datetime-local", required: true, min: form.submissionStartAt })}
        </fieldset>
        <fieldset className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">2. Voting window</legend>
          {field("votingStartAt", "Opens", { type: "datetime-local", required: true, min: form.submissionEndAt })}
          {field("votingEndAt", "Closes", { type: "datetime-local", required: true, min: form.votingStartAt })}
        </fieldset>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <button disabled={saving} className="w-full rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 sm:w-auto">{saving ? "Creating…" : "Create campaign"}</button>
          <button type="button" onClick={() => setForm(EMPTY)} className="w-full rounded-full px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:w-auto">Clear form</button>
        </div>
      </form>

      <div className="space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading campaigns…</p>}
        {!loading && !campaigns.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No campaigns yet. Create your first one above.</p>}
        {campaigns.map((c) => (
          <article key={c.id} className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">{c.name}</h2>
              {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
              <p className="mt-2 text-sm text-slate-600">Submit: {fmt(c.submissionStartAt)} – {fmt(c.submissionEndAt)}</p>
              <p className="text-sm text-slate-600">Vote: {fmt(c.votingStartAt)} – {fmt(c.votingEndAt)}</p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <label className="text-xs font-semibold text-slate-500">Status
                <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-900">
                  {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </label>
              <Link href={`/admin/rankings?campaignId=${c.id}`} className="rounded-full px-4 py-2 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50">Live rankings →</Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
