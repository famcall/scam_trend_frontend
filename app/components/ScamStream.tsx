"use client";

import { useEffect, useRef, useState } from "react";

type ScamItem = {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  scam_score: number;
  scam_categories: string[];
};

export default function ScamStream() {
  const [items, setItems] = useState<ScamItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(0.3); // スクロール速度
  const pausedRef = useRef(false);

  // データ取得
  useEffect(() => {
    fetch("http://localhost:3000/api/data", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (json?.semantic?.items) {
          // リスクスコア順でソート（高→低）
          const sorted = [...json.semantic.items].sort(
            (a: ScamItem, b: ScamItem) => b.scam_score - a.scam_score
          );
          setItems(sorted);
        }
      });
  }, []);

  // 自動スクロール
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number;

    const scroll = () => {
      if (!pausedRef.current) {
        el.scrollTop += speedRef.current;

        // ループ処理
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          el.scrollTop = 0;
        }
      }
      rafId = requestAnimationFrame(scroll);
    };

    rafId = requestAnimationFrame(scroll);

    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white overflow-hidden">
      {/* ヘッダー */}
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-wide">
          Scam Trend Stream
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => (pausedRef.current = !pausedRef.current)}
            className="px-3 py-1 text-xs bg-zinc-800 rounded"
          >
            ⏯ Pause
          </button>
          <button
            onClick={() => (speedRef.current = 0.1)}
            className="px-2 py-1 text-xs bg-zinc-800 rounded"
          >
            Slow
          </button>
          <button
            onClick={() => (speedRef.current = 0.3)}
            className="px-2 py-1 text-xs bg-zinc-800 rounded"
          >
            Normal
          </button>
          <button
            onClick={() => (speedRef.current = 0.8)}
            className="px-2 py-1 text-xs bg-zinc-800 rounded"
          >
            Fast
          </button>
        </div>
      </div>

      {/* ストリーム */}
      <div
        ref={containerRef}
        className="h-[calc(100vh-64px)] overflow-y-scroll scrollbar-hide px-4 py-6 space-y-4"
      >
        {[...items, ...items].map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-4 shadow-lg"
          >
            {/* リスクバー */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  item.scam_score >= 5
                    ? "bg-red-500"
                    : item.scam_score >= 3
                    ? "bg-yellow-400"
                    : "bg-green-400"
                }`}
              />
              <span className="text-xs text-zinc-400">
                Risk {item.scam_score}
              </span>
              <span className="text-xs text-zinc-500">
                {item.scam_categories.join(", ")}
              </span>
            </div>

            <h2 className="text-sm font-semibold leading-snug mb-1">
              {item.title}
            </h2>

            <p className="text-xs text-zinc-400 line-clamp-2 mb-2">
              {item.content}
            </p>

            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>{item.source}</span>
              <a
                href={item.url}
                target="_blank"
                className="hover:text-white"
              >
                open →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}