"use client";

import { useState, useEffect, useRef } from "react";
import type { Occasion, Season, ClothingItem } from "@/lib/types";

interface OutfitVariant {
  label: string;
  item_ids: string[];
  items: ClothingItem[];
  rationale: string;
  style_tip: string;
}

interface OutfitResult {
  name: string;
  core_item_ids: string[];
  core_items: ClothingItem[];
  rating: number;
  variants: OutfitVariant[];
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "transform 600ms", transform: spinning ? "rotate(360deg)" : "none" }}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function OutfitSkeleton() {
  return (
    <div className="card" style={{ overflow: "hidden", padding: 0 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="shimmer" style={{ height: "16px", width: "40%", borderRadius: "4px" }} />
        <div className="shimmer" style={{ height: "24px", width: "52px", borderRadius: "6px" }} />
      </div>
      <div style={{ padding: "1rem 1.25rem" }}>
        <div className="shimmer" style={{ height: "9px", width: "25%", borderRadius: "4px", marginBottom: "12px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginBottom: "1rem" }}>
          {[0, 1, 2].map(j => <div key={j} className="shimmer" style={{ aspectRatio: "3/4", borderRadius: "8px" }} />)}
        </div>
        <div className="shimmer" style={{ height: "9px", width: "55%", borderRadius: "4px", marginBottom: "6px" }} />
        <div className="shimmer" style={{ height: "9px", width: "40%", borderRadius: "4px" }} />
      </div>
    </div>
  );
}

interface Props {
  occasion: Occasion;
  season: Season;
  weather: string | null;
  onClose: () => void;
}

const OCC_LABELS: Record<Occasion, string> = {
  casual: "Casual", work: "Work", date_night: "Date Night", workout: "Workout",
};

const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];

export default function OutfitSheet({ occasion, season, weather, onClose }: Props) {
  const [visible, setVisible]           = useState(false);
  const [currentSeason, setCurrentSeason] = useState<Season>(season);
  const [loading, setLoading]           = useState(false);
  const [outfits, setOutfits]           = useState<OutfitResult[]>([]);
  const [error, setError]               = useState("");
  const [variantMap, setVariantMap]     = useState<Map<number, number>>(new Map());
  const [wornMap, setWornMap]           = useState<Map<number, string>>(new Map());
  const [ratingMap, setRatingMap]       = useState<Map<number, number>>(new Map());
  const [saveMap, setSaveMap]           = useState<Map<number, string>>(new Map());
  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const pendingRatings                  = useRef<Map<number, number>>(new Map());

  // Animate in on mount
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Flush pending ratings when wornMap updates
  useEffect(() => {
    wornMap.forEach((entryId, index) => {
      if (pendingRatings.current.has(index) && entryId) {
        const rating = pendingRatings.current.get(index)!;
        pendingRatings.current.delete(index);
        fetch("/api/outfits/rate", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entryId, rating }),
        });
      }
    });
  }, [wornMap]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function triggerProfileUpdate() {
    fetch("/api/style-profile", { method: "POST" })
      .then(r => r.ok && showToast("Style profile updated"))
      .catch(() => {});
  }

  function close() {
    setVisible(false);
    setTimeout(onClose, 320);
  }

  async function autoSaveOutfit(outfit: OutfitResult, idx: number, sea: Season): Promise<string> {
    const variant = outfit.variants?.[0];
    if (!variant) return "";
    const allItemIds = [...outfit.core_item_ids, ...variant.item_ids];
    const r = await fetch("/api/outfits/history", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_ids: allItemIds, occasion, season: sea, style_rationale: `${outfit.name || ""}||${variant.label || ""}||${variant.rationale}` }),
    });
    const d = await r.json();
    return d.entry?.id ?? "";
  }

  async function generate(excludeIds?: string[][], overrideSeason?: Season) {
    const sea = overrideSeason ?? currentSeason;
    setLoading(true); setError(""); setOutfits([]);
    setWornMap(new Map()); setRatingMap(new Map()); setVariantMap(new Map());
    pendingRatings.current.clear();

    const res  = await fetch("/api/outfits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occasion, season: sea, weather, savedCombos: excludeIds }) });
    const data = await res.json();

    if (!res.ok) { setError(data.error || "Failed to generate outfits"); setLoading(false); return; }

    const newOutfits: OutfitResult[] = data.outfits;
    setOutfits(newOutfits);
    setLoading(false);

    // Auto-save all outfits in parallel, populate wornMap for immediate rating
    const entries = await Promise.all(newOutfits.map((o, i) => autoSaveOutfit(o, i, sea)));
    setWornMap(new Map(entries.map((id, i) => [i, id])));
  }

  function changeSeason(s: Season) {
    setCurrentSeason(s);
    setOutfits([]);
    setError("");
  }

  async function refreshSingle(outfitIdx: number) {
    const toExclude = outfits[outfitIdx];
    setRefreshingIdx(outfitIdx);
    const res = await fetch("/api/outfits", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occasion, season: currentSeason, weather, savedCombos: [toExclude.core_item_ids] }),
    });
    const data = await res.json();
    if (res.ok && data.outfits?.length > 0) {
      const newOutfit: OutfitResult = data.outfits[0];
      setOutfits(prev => prev.map((o, i) => i === outfitIdx ? newOutfit : o));
      setRatingMap(prev => { const m = new Map(prev); m.delete(outfitIdx); return m; });
      setVariantMap(prev => { const m = new Map(prev); m.delete(outfitIdx); return m; });
      const entryId = await autoSaveOutfit(newOutfit, outfitIdx, currentSeason);
      setWornMap(prev => new Map([...prev, [outfitIdx, entryId]]));
    }
    setRefreshingIdx(null);
  }

  async function rate(index: number, value: number) {
    const entryId   = wornMap.get(index);
    const current   = ratingMap.get(index) ?? 0;
    const newRating = current === value ? 0 : value;
    setRatingMap(prev => new Map([...prev, [index, newRating]]));
    if (entryId) {
      const r = await fetch("/api/outfits/rate", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entryId, rating: newRating }) });
      const d = await r.json();
      if (d.should_update_profile) triggerProfileUpdate();
    } else {
      pendingRatings.current.set(index, newRating);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
        backgroundColor: "var(--c-bg)",
        borderRadius: "20px 20px 0 0",
        maxHeight: "88vh",
        display: "flex",
        flexDirection: "column",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 340ms cubic-bezier(0.32, 0.72, 0, 1)",
        paddingBottom: "env(safe-area-inset-bottom, 16px)",
      }}>
        {/* Handle + header */}
        <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
          <div style={{
            width: "36px", height: "4px", borderRadius: "2px",
            backgroundColor: "var(--c-border-2)",
            margin: "0 auto 16px",
          }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <p className="page-label">AI Stylist</p>
              <h2 style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.75rem",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                color: "var(--c-fg)",
              }}>
                {OCC_LABELS[occasion]}
              </h2>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {outfits.length > 0 && (
                <button
                  onClick={() => generate(outfits.map(o => o.core_item_ids))}
                  disabled={loading}
                  className="btn-ghost"
                  style={{ minHeight: "36px", padding: "0 14px", fontSize: "0.75rem" }}
                >
                  Regenerate
                </button>
              )}
              <button
                onClick={close}
                style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  border: "1.5px solid var(--c-border)",
                  backgroundColor: "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--c-fg-muted)",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Season picker */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
            {SEASONS.map(s => (
              <button
                key={s}
                onClick={() => changeSeason(s)}
                disabled={loading}
                className={`chip${currentSeason === s ? " active" : ""}`}
                style={{ textTransform: "capitalize", minHeight: "34px", padding: "0 14px", fontSize: "0.75rem" }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Generate button */}
          {!loading && outfits.length === 0 && (
            <button onClick={() => generate()} className="btn-primary" style={{ width: "100%", minHeight: "48px", marginBottom: "16px" }}>
              Generate Outfits
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "0 16px 16px", flex: 1 }}>
          {/* Error */}
          {error && (
            <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "var(--r-md)", padding: "12px 14px", color: "#991B1B", fontSize: "0.875rem", marginBottom: "1rem" }}>
              {error}
              {error.includes("Not enough") && (
                <a href="/wardrobe" style={{ display: "block", marginTop: "6px", color: "#991B1B", fontWeight: 600, textDecoration: "underline" }}>
                  Go to wardrobe →
                </a>
              )}
            </div>
          )}

          {/* Outfit cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loading
              ? [0, 1, 2].map(i => <OutfitSkeleton key={i} />)
              : outfits.map((outfit, i) => {
                  const currentRating   = ratingMap.get(i) ?? 0;
                  const selectedVariant = variantMap.get(i) ?? 0;
                  const variant         = outfit.variants?.[selectedVariant];
                  const isRefreshing    = refreshingIdx === i;
                  const isSaved         = wornMap.has(i) && wornMap.get(i) !== "";

                  return (
                    <div key={i} className="card" style={{ overflow: "hidden", padding: 0, opacity: isRefreshing ? 0.5 : 1, transition: "opacity 200ms" }}>

                      {/* Card header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700 }}>
                            {outfit.name || `Look ${i + 1}`}
                          </span>
                          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--c-gold)", backgroundColor: "var(--c-gold-bg)", border: "1px solid #E8D9A0", padding: "2px 8px", borderRadius: "var(--r-sm)" }}>
                            {outfit.rating}/10
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            onClick={() => !isRefreshing && refreshSingle(i)}
                            disabled={isRefreshing || refreshingIdx !== null}
                            title="Try a different outfit"
                            style={{ width: "30px", height: "30px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-border)", backgroundColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isRefreshing ? "default" : "pointer", color: "var(--c-fg-muted)" }}
                          >
                            <RefreshIcon spinning={isRefreshing} />
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ padding: "1rem 1.25rem" }}>
                        <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)", marginBottom: "10px" }}>The Base</p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "8px", marginBottom: "1rem" }}>
                          {outfit.core_items.map(item => (
                            <div key={item.id} style={{ textAlign: "center" }}>
                              <div style={{ aspectRatio: "3/4", borderRadius: "var(--r-sm)", overflow: "hidden", border: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)" }}>
                                <img src={item.image_url} alt={item.subcategory || item.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                              <p style={{ fontSize: "0.6rem", color: "var(--c-fg-muted)", marginTop: "4px", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subcategory || item.category}</p>
                            </div>
                          ))}
                        </div>

                        {outfit.variants?.length > 0 && (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                              <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)", flexShrink: 0 }}>Finish With</p>
                              <div style={{ display: "flex", gap: "6px" }}>
                                {outfit.variants.map((v, vi) => (
                                  <button key={vi} onClick={() => setVariantMap(prev => new Map([...prev, [i, vi]]))}
                                    style={{ padding: "3px 12px", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 150ms", border: selectedVariant === vi ? "1.5px solid var(--c-fg)" : "1.5px solid var(--c-border)", backgroundColor: selectedVariant === vi ? "var(--c-fg)" : "transparent", color: selectedVariant === vi ? "var(--c-bg)" : "var(--c-fg-soft)" }}>
                                    {v.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {variant && (
                              <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "8px", marginBottom: "1rem" }}>
                                  {variant.items.map(item => (
                                    <div key={item.id} style={{ textAlign: "center" }}>
                                      <div style={{ aspectRatio: (item.category === "shoes" || item.category === "accessory") ? "1/1" : "3/4", borderRadius: "var(--r-sm)", overflow: "hidden", border: "1.5px solid var(--c-fg)", backgroundColor: "var(--c-surface-2)" }}>
                                        <img src={item.image_url} alt={item.subcategory || item.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      </div>
                                      <p style={{ fontSize: "0.6rem", color: "var(--c-fg-muted)", marginTop: "4px", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subcategory || item.category}</p>
                                    </div>
                                  ))}
                                </div>

                                <p style={{ fontSize: "0.875rem", color: "var(--c-fg-soft)", lineHeight: 1.7, marginBottom: "0.875rem" }}>{variant.rationale}</p>

                                <div className="gold-bar" style={{ marginBottom: "0.875rem" }}>
                                  <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-muted)", lineHeight: 1.65 }}>
                                    <span style={{ fontWeight: 600, color: "var(--c-fg)" }}>Style tip: </span>
                                    {variant.style_tip}
                                  </p>
                                </div>

                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button onClick={() => rate(i, 5)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 14px", borderRadius: "var(--r-sm)", border: `1.5px solid ${currentRating === 5 ? "#86EFAC" : "var(--c-border)"}`, backgroundColor: currentRating === 5 ? "#F0FDF4" : "transparent", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: 500, color: currentRating === 5 ? "#166534" : "var(--c-fg-muted)", transition: "all 150ms" }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill={currentRating === 5 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                                      Like
                                    </button>
                                    <button onClick={() => rate(i, 1)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 14px", borderRadius: "var(--r-sm)", border: `1.5px solid ${currentRating === 1 ? "#FECACA" : "var(--c-border)"}`, backgroundColor: currentRating === 1 ? "#FEF2F2" : "transparent", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: 500, color: currentRating === 1 ? "#991B1B" : "var(--c-fg-muted)", transition: "all 150ms" }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill={currentRating === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                                      Dislike
                                    </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)", backgroundColor: "var(--c-fg)", color: "var(--c-bg)", padding: "10px 20px", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 600, zIndex: 200, whiteSpace: "nowrap", pointerEvents: "none", animation: "fadeUp 200ms ease both" }}>
          {toast}
        </div>
      )}
    </>
  );
}
