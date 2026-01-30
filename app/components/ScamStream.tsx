"use client";

import { useEffect, useRef, useState } from "react";
import ScamCard from "./ScamCard";

type RiskObject = {
  score?: number;
  level?: "low" | "medium" | "high" | "critical";
  confidence?: number;
  categories?: string[];
  reasons?: string[];
};

type EventItem = {
  event_id: string;
  timestamp?: string;
  title?: string;
  content?: string;
  source?: string;
  url?: string;
  risk?: RiskObject;
};

export default function ScamStream() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // scroll control
  const speedRef = useRef<number>(0.25);
  const pausedRef = useRef<boolean>(false);

  // =========================
  // Data Fetch (Risk API)
  // =========================
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/risk?limit=200&minScore=0", {
          cache: "no-store",
        });
        const json = await res.json();

        const list: EventItem[] = json?.data?.events ?? [];

        // 並び順ルール（商品設計）
        // 1. risk.score DESC
        // 2. timestamp DESC
        const sorted = [...list].sort((a, b) => {
          const s = (b?.risk?.score ?? 0) - (a?.risk?.score ?? 0);
          if (s !== 0) return s;

          const ta = new Date(a?.timestamp ?? 0).getTime();
          const tb = new Date(b?.timestamp ?? 0).getTime();
          return tb - ta;
        });

        if (mounted) {
          setEvents(sorted);
          setLoading(false);
        }
      } catch (e) {
        console.error("Risk API fetch error:", e);
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // =========================
  // Auto Scroll Engine
  // =========================
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number;

    const tick = () => {
      if (!pausedRef.current) {
        el.scrollTop += speedRef.current;

        // 無限ループ
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          el.scrollTop = 0;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white overflow-hidden">

      {/* =========================
          Header
      ========================= */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center backdrop-blur bg-black/40 sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-bold tracking-wide">
            Scam Trend Stream
          </h1>
          <div className="text-xs text-zinc-400">
            Real-time Risk Intelligence Platform
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <div className="text-xs text-zinc-400 mr-3">
            EVENTS: {events.length}
          </div>

          <button
            onClick={() => (pausedRef.current = !pausedRef.current)}
            className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition"
          >
            {pausedRef.current ? "▶ Resume" : "⏸ Pause"}
          </button>

          <button
            onClick={() => (speedRef.current = 0.1)}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            Slow
          </button>

          <button
            onClick={() => (speedRef.current = 0.25)}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            Normal
          </button>

          <button
            onClick={() => (speedRef.current = 0.6)}
            className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded"
          >
            Fast
          </button>
        </div>
      </div>

      {/* =========================
          Stream Body
      ========================= */}
      <div
        ref={containerRef}
        className="h-[calc(100vh-80px)] overflow-y-scroll px-4 py-6 space-y-4 scrollbar-hide"
      >
        {loading && (
          <div className="text-center text-zinc-500 text-sm mt-10 animate-pulse">
            Loading risk intelligence stream...
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-10">
            No risk events available
          </div>
        )}

        {/* 無限ストリーム描画 */}
        {!loading &&
          [...events, ...events].map((ev, i) => (
            <ScamCard key={`${ev.event_id}-${i}`} event={ev} />
          ))}
      </div>
    </div>
  );
}