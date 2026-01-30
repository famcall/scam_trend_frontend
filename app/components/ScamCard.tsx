"use client";

type EventItem = {
  event_id: string;
  title?: string;
  content?: string;
  source?: string;
  url?: string;
  risk?: {
    score?: number;
    level?: "low" | "medium" | "high" | "critical";
    confidence?: number;
    categories?: string[];
  };
};

export default function ScamCard({ event }: { event: EventItem }) {
  const score = event?.risk?.score ?? 0;
  const cats = event?.risk?.categories ?? [];

  const dot =
    score >= 80 ? "bg-red-500" :
    score >= 60 ? "bg-orange-400" :
    score >= 35 ? "bg-yellow-300" :
    "bg-green-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-xs text-zinc-400">Risk {score}</span>
        <span className="text-xs text-zinc-500 truncate">{cats.join(", ")}</span>
      </div>

      <h2 className="text-sm font-semibold leading-snug mb-1">
        {event.title || "(no title)"}
      </h2>

      <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
        {event.content || ""}
      </p>

      <div className="flex justify-between items-center text-[10px] text-zinc-500">
        <span className="truncate">{event.source || "unknown"}</span>
        {event.url ? (
          <a href={event.url} target="_blank" rel="noreferrer" className="hover:text-white">
            open →
          </a>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}