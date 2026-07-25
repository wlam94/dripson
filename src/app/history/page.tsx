"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { OutfitHistoryEntry, ClothingItem } from "@/lib/types";

const OCCASIONS = [
  { value: "casual",     label: "Casual"     },
  { value: "work",       label: "Work"        },
  { value: "date_night", label: "Date Night"  },
  { value: "workout",    label: "Workout"     },
];

const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall",   label: "Fall"   },
  { value: "winter", label: "Winter" },
];

function getCurrentSeason(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<OutfitHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [localRatings, setLocalRatings] = useState<Map<string, number>>(new Map());
  const [activeOccasion, setActiveOccasion] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<string | null>(null);

  useEffect(() => {
    // Pre-set filters from URL params (e.g. from home page occasion cards)
    const params = new URLSearchParams(window.location.search);
    const occ = params.get("occasion");
    if (occ) setActiveOccasion(occ);

    async function load() {
      const { data: history } = await getSupabase()
        .from("outfit_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (!history?.length) { setLoading(false); return; }
      const allIds = [...new Set(history.flatMap((h: OutfitHistoryEntry) => h.item_ids))];
      const { data: items } = await getSupabase().from("clothing_items").select("*").in("id", allIds);
      const itemMap = new Map((items || []).map((i: ClothingItem) => [i.id, i]));
      setEntries(history.map((h: OutfitHistoryEntry) => ({
        ...h,
        items: h.item_ids.map((id) => itemMap.get(id)).filter(Boolean) as ClothingItem[],
      })));
      setLoading(false);
    }
    load();
  }, []);

  async function rate(id: string, rating: number) {
    setLocalRatings((prev) => new Map([...prev, [id, rating]]));
    await fetch("/api/outfits/rate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rating }),
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const label = (o: string) => o.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  // Client-side filtering + season-priority sort
  const currentSeason = getCurrentSeason();
  const seasonPriority = [
    currentSeason,
    ...SEASONS.map(s => s.value).filter(s => s !== currentSeason),
  ];

  const filtered = entries
    .filter((e) => {
      if (activeOccasion && e.occasion !== activeOccasion) return false;
      if (activeSeason && e.season !== activeSeason) return false;
      return true;
    })
    .sort((a, b) => seasonPriority.indexOf(a.season) - seasonPriority.indexOf(b.season));

  const isFiltered = activeOccasion || activeSeason;

  return (
    <div className="page-content" style={{ maxWidth: "640px" }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <p className="page-label">Log</p>
          <h1 className="page-title">History</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
          {activeOccasion && (
            <a
              href={`/outfits?occasion=${activeOccasion}`}
              className="btn-primary"
              style={{ textDecoration: "none", fontSize: "0.75rem", minHeight: "34px", padding: "0 14px", display: "flex", alignItems: "center" }}
            >
              Generate New
            </a>
          )}
          {entries.length > 0 && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "2.25rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {isFiltered ? filtered.length : entries.length}
                {isFiltered && entries.length !== filtered.length && (
                  <span style={{ fontSize: "1rem", color: "var(--c-fg-muted)", fontWeight: 400 }}>/{entries.length}</span>
                )}
              </p>
              <p style={{ fontSize: "0.6rem", color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>outfits</p>
            </div>
          )}
        </div>
      </div>

      {/* Prominent generate CTA when browsing a specific occasion */}
      {!loading && activeOccasion && (
        <a
          href={`/outfits?occasion=${activeOccasion}`}
          className="btn-primary anim-fade-up"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", minHeight: "52px", fontSize: "0.875rem", marginBottom: "1.5rem" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Generate New {activeOccasion.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())} Look
        </a>
      )}

      {/* Filters */}
      {!loading && entries.length > 0 && (
        <div className="anim-fade-up d-1" style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Occasion filter */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
            <button
              onClick={() => setActiveOccasion(null)}
              className={`chip${!activeOccasion ? " active" : ""}`}
              style={{ flexShrink: 0 }}
            >
              All Occasions
            </button>
            {OCCASIONS.map(({ value, label: lbl }) => {
              const count = entries.filter(e => e.occasion === value).length;
              if (count === 0) return null;
              return (
                <button
                  key={value}
                  onClick={() => setActiveOccasion(activeOccasion === value ? null : value)}
                  className={`chip${activeOccasion === value ? " active" : ""}`}
                  style={{ flexShrink: 0 }}
                >
                  {lbl} ({count})
                </button>
              );
            })}
          </div>

          {/* Season filter — current season listed first */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
            <button
              onClick={() => setActiveSeason(null)}
              className={`chip${!activeSeason ? " active" : ""}`}
              style={{ flexShrink: 0 }}
            >
              All Seasons
            </button>
            {[...SEASONS].sort((a, b) => seasonPriority.indexOf(a.value) - seasonPriority.indexOf(b.value)).map(({ value, label: lbl }) => {
              const count = entries.filter(e => e.season === value).length;
              if (count === 0) return null;
              return (
                <button
                  key={value}
                  onClick={() => setActiveSeason(activeSeason === value ? null : value)}
                  className={`chip${activeSeason === value ? " active" : ""}`}
                  style={{ flexShrink: 0 }}
                >
                  {lbl} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--c-fg-muted)", fontSize: "0.875rem" }}>Loading...</p>
      ) : entries.length === 0 ? (
        <div className="anim-scale-in" style={{ textAlign: "center", padding: "6rem 0" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", marginBottom: "6px", fontWeight: 600 }}>No outfits logged yet.</p>
          <p style={{ color: "var(--c-fg-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Generate an outfit to start building your log.</p>
          <a href="/outfits" className="btn-primary" style={{ textDecoration: "none" }}>Generate Outfit</a>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 0" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 600, marginBottom: "6px" }}>No matches.</p>
          <p style={{ color: "var(--c-fg-muted)", fontSize: "0.875rem" }}>Try a different filter combination.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((entry, idx) => {
            const isOpen = expanded.has(entry.id);
            const currentRating = localRatings.get(entry.id) ?? entry.user_rating ?? 0;
            const d = new Date(entry.worn_date);
            const day = d.getDate();
            const month = d.toLocaleDateString("en-US", { month: "short" });

            const [embeddedName, ...rationaleParts] = (entry.style_rationale || "").split("||");
            const outfitName = rationaleParts.length > 0 ? embeddedName.trim() : null;
            const rationale = rationaleParts.length > 0 ? rationaleParts.join("||") : entry.style_rationale;

            return (
              <div
                key={entry.id}
                className={`card anim-fade-up${idx > 0 ? ` d-${Math.min(idx, 4)}` : ""}`}
                style={{
                  overflow: "hidden", padding: 0,
                  outline: currentRating === 5 ? "1.5px solid #86EFAC" : currentRating === 1 ? "1.5px solid #FECACA" : "none",
                }}
              >
                {/* Collapsed header */}
                <div
                  onClick={() => toggleExpand(entry.id)}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  {/* Meta row */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px 10px" }}>
                    {/* Date pill */}
                    <div style={{
                      flexShrink: 0, backgroundColor: "var(--c-surface-2)",
                      border: "1px solid var(--c-border)", borderRadius: "8px",
                      padding: "4px 10px", textAlign: "center",
                    }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, lineHeight: 1, color: "var(--c-fg)" }}>{day}</p>
                      <p style={{ fontSize: "0.5rem", color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "1px" }}>{month}</p>
                    </div>

                    {/* Name + tags */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--c-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {outfitName || label(entry.occasion)}
                      </p>
                      <div style={{ display: "flex", gap: "5px", marginTop: "3px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.58rem", padding: "1px 6px", borderRadius: "100px", backgroundColor: "var(--c-surface-2)", color: "var(--c-fg-muted)", textTransform: "capitalize", border: "1px solid var(--c-border)" }}>
                          {entry.season}
                        </span>
                        <span style={{ fontSize: "0.58rem", padding: "1px 6px", borderRadius: "100px", backgroundColor: "var(--c-surface-2)", color: "var(--c-fg-muted)", textTransform: "capitalize", border: "1px solid var(--c-border)" }}>
                          {label(entry.occasion)}
                        </span>
                        {currentRating === 5 && <span style={{ fontSize: "0.7rem" }}>👍</span>}
                        {currentRating === 1 && <span style={{ fontSize: "0.7rem" }}>👎</span>}
                      </div>
                    </div>

                    {/* Chevron */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* Photo strip — large, always visible */}
                  {entry.items && entry.items.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", padding: "0 4px 0" }}>
                      {entry.items.map((item) => (
                        <div key={item.id} style={{
                          flex: 1,
                          height: "160px",
                          borderRadius: "6px",
                          overflow: "hidden",
                          border: "1px solid var(--c-border)",
                          backgroundColor: "var(--c-surface-2)",
                          flexShrink: 0,
                        }}>
                          <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick like/dislike — no expand needed */}
                  <div
                    style={{ display: "flex", gap: "6px", padding: "10px 14px 12px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => rate(entry.id, currentRating === 5 ? 0 : 5)}
                      style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        padding: "5px 14px", borderRadius: "var(--r-sm)",
                        border: `1.5px solid ${currentRating === 5 ? "#86EFAC" : "var(--c-border)"}`,
                        backgroundColor: currentRating === 5 ? "#F0FDF4" : "transparent",
                        cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: 500,
                        color: currentRating === 5 ? "#166534" : "var(--c-fg-muted)",
                        transition: "all 150ms",
                      }}
                    >
                      👍 Like
                    </button>
                    <button
                      onClick={() => rate(entry.id, currentRating === 1 ? 0 : 1)}
                      style={{
                        display: "flex", alignItems: "center", gap: "5px",
                        padding: "5px 14px", borderRadius: "var(--r-sm)",
                        border: `1.5px solid ${currentRating === 1 ? "#FECACA" : "var(--c-border)"}`,
                        backgroundColor: currentRating === 1 ? "#FEF2F2" : "transparent",
                        cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: 500,
                        color: currentRating === 1 ? "#991B1B" : "var(--c-fg-muted)",
                        transition: "all 150ms",
                      }}
                    >
                      👎 Dislike
                    </button>
                    {currentRating > 0 && (
                      <span style={{ fontSize: "0.68rem", color: "var(--c-fg-muted)", alignSelf: "center" }}>
                        {currentRating === 5 ? "More like this" : "Fewer like this"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded — rationale only (like/dislike already in collapsed row) */}
                {isOpen && rationale && (
                  <div style={{ borderTop: "1px solid var(--c-border)", padding: "14px 14px 14px" }}>
                    <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-soft)", lineHeight: 1.7, margin: 0 }}>
                      {rationale}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
