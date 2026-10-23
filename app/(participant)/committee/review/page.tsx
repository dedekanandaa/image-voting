"use client";

import { useEffect, useState } from "react";

type Submission = { id: string; title: string | null; imageUrl: string; isSelected: boolean; voteCount: number; frameId: string | null; submitterName: string };
type Campaign = { id: string; name: string; status: string };

export default function CommitteeReviewPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [message, setMessage] = useState("");
  const campaign = campaigns.find((item) => item.id === campaignId);

  useEffect(() => {
    fetch("/api/campaigns").then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error || "Unable to load campaigns");
      return response.json();
    }).then((items: Campaign[]) => {
      setCampaigns(items);
      if (items[0]) setCampaignId(items[0].id);
    }).catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/submissions/all?campaignId=${campaignId}`).then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error || "Unable to load submissions");
      return response.json();
    }).then(setSubmissions).catch((error) => setMessage(error.message));
  }, [campaignId]);

  async function toggle(submission: Submission) {
    setMessage("");
    const response = await fetch(`/api/submissions/${submission.id}/select`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isSelected: !submission.isSelected }) });
    if (response.ok) setSubmissions((items) => items.map((item) => item.id === submission.id ? { ...item, isSelected: !item.isSelected } : item));
    else setMessage((await response.json()).error || "Update failed");
  }

  async function deleteSubmission(submission: Submission) {
    if (!window.confirm("Delete this submission? This cannot be undone.")) return;
    setMessage("");
    const response = await fetch(`/api/submissions/${submission.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage((await response.json()).error || "Delete failed");
    setSubmissions((items) => items.filter((item) => item.id !== submission.id));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">Committee tools</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="font-serif text-4xl font-semibold">Review submissions</h1><p className="mt-2 text-sm text-slate-600">Select every image that should appear in voting.</p></div>
        <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="rounded-full border border-slate-200 bg-white px-4 py-3 font-semibold">
          {!campaigns.length && <option value="">No campaigns</option>}
          {campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      {(() => {
        const grouped = submissions.reduce((acc, sub) => {
          const key = sub.submitterName;
          acc[key] = (acc[key] || []).concat(sub);
          return acc;
        }, {} as Record<string, Submission[]>);

        return Object.entries(grouped).map(([name, subs]) => (
          <div key={name} className="mt-8">
            <h2 className="mb-4 font-semibold text-slate-700">{name}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {subs.map((submission) => (
                <article key={submission.id} className={`overflow-hidden rounded-2xl bg-white shadow-sm ${submission.isSelected ? "ring-2 ring-emerald-400" : ""}`}>
                  <img src={submission.imageUrl} alt={`Submission by ${submission.submitterName}`} className="aspect-[3/4] w-full object-cover" />
                  <div className="p-3">
                    <p className="font-semibold">{submission.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{submission.frameId || "Legacy frame"} · {submission.voteCount} votes</p>
                    <button onClick={() => toggle(submission)} className={`mt-3 w-full rounded-full px-3 py-2 text-xs font-bold text-white ${submission.isSelected ? "bg-emerald-600" : "bg-slate-700"}`}>{submission.isSelected ? "Approved" : "Select approve"}</button>
                    <button onClick={() => deleteSubmission(submission)} className="mt-2 w-full rounded-full bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Delete submission</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ));
      })()}
      {campaign && !submissions.length && <p className="mt-10 text-center text-sm text-slate-500">No submissions in this campaign.</p>}
    </main>
  );
}
