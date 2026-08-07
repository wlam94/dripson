"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Occasion, Season, ClothingItem } from "@/lib/types";

function SunIcon()       { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>; }
function BriefcaseIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>; }
function StarIcon()       { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function BoltIcon()       { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>; }

const OCCASIONS: { value: Occasion; label: string; Icon: () => React.JSX.Element }[] = [
  { value: "casual",     label: "Casual",     Icon: SunIcon       },
  { value: "work",       label: "Work",        Icon: BriefcaseIcon },
  { value: "date_night", label: "Date Night",  Icon: StarIcon      },
  { value: "workout",    label: "Workout",     Icon: BoltIcon      },
];

const SEASONS: { value: Season; label: string }[] = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall",   label: "Fall"   },
  { value: "winter", label: "Winter" },
];

function getCurrentSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

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

function OutfitSkeleton() {
  return (
    <div className="card" style={{ overflow: "hidden", padding: 0 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="shimmer" style={{ height: "18px", width: "42%", borderRadius: "4px" }} />
        <div className="shimmer" style={{ height: "28px", width: "56px", borderRadius: "6px" }} />
      </div>
      <div style={{ padding: "1.25rem 1.5rem" }}>
        <div className="shimmer" style={{ height: "10px", width: "28%", borderRadius: "4px", marginBottom: "14px" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "1.25rem" }}>
          {[0, 1, 2].map(j => <div key={j} className="shimmer" style={{ aspectRatio: "3/4", borderRadius: "8px" }} />)}
        </div>
        <div className="shimmer" style={{ height: "10px", width: "60%", borderRadius: "4px", marginBottom: "8px" }} />
        <div className="shimmer" style={{ height: "10px", width: "45%", borderRadius: "4px" }} />
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "transform 600ms", transform: spinning ? "rotate(360deg)" : "none" }}
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export default function OutfitsPage() {
  const [occasion, setOccasion]         = useState<Occasion>("casual");
  const [season, setSeason]             = useState<Season>(getCurrentSeason());
  const [loading, setLoading]           = useState(false);
  const [outfits, setOutfits]           = useState<OutfitResult[]>([]);
  const [error, setError]               = useState("");
  const [weather, setWeather]           = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [variantMap, setVariantMap]     = useState<Map<number, number>>(new Map());
  const [wornMap, setWornMap]           = useState<Map<number, string>>(new Map());
  const [ratingMap, setRatingMap]       = useState<Map<number, number>>(new Map());
  const [saveMap, setSaveMap]           = useState<Map<number, string>>(new Map());
  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const didAutoGenerate                 = useRef(false);
  const pendingRatings                  = useRef<Map<number, number>>(new Map());

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function triggerProfileUpdate() {
    fetch("/api/style-profile", { method: "POST" })
      .then(r => r.ok && showToast("Style profile updated"))
      .catch(() => {});
  }

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

  async function generate(params?: { occasion?: Occasion; season?: Season; weather?: string | null }) {
    const occ = params?.occasion ?? occasion;
    const sea = params?.season   ?? season;
    const wth = params !== undefined && "weather" in params ? params.weather : weather;

    const cacheKey = `dripson_outfits_${occ}_${sea}`;
    if (!params) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as OutfitResult[];
          setOutfits(parsed); setSaveMap(new Map()); setWornMap(new Map()); setRatingMap(new Map()); setVariantMap(new Map());
          return;
        } catch { /* ignore */ }
      }
    }

    setLoading(true); setError(""); setOutfits([]);
    setWornMap(new Map()); setRatingMap(new Map()); setVariantMap(new Map()); setSaveMap(new Map());
    pendingRatings.current.clear();

    const res  = await fetch("/api/outfits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occasion: occ, season: sea, weather: wth }) });
    const data = await res.json();

    if (!res.ok) { setError(data.error || "Failed to generate outfits"); setLoading(false); return; }
    setOutfits(data.outfits);
    setLoading(false);
    try { sessionStorage.setItem(cacheKey, JSON.stringify(data.outfits)); } catch { /* ignore */ }
  }

  async function refreshSingle(outfitIdx: number) {
    const toExclude = outfits[outfitIdx];
    setRefreshingIdx(outfitIdx);
    const res = await fetch("/api/outfits", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occasion, season, weather, savedCombos: [toExclude.core_item_ids] }),
    });
    const data = await res.json();
    if (res.ok && data.outfits?.length > 0) {
      setOutfits(prev => prev.map((o, i) => i === outfitIdx ? data.outfits[0] : o));
      try { sessionStorage.removeItem(`dripson_outfits_${occasion}_${season}`); } catch { /* ignore */ }
      // Reset state for this card
      setSaveMap(prev => { const m = new Map(prev); m.delete(outfitIdx); return m; });
      setWornMap(prev => { const m = new Map(prev); m.delete(outfitIdx); return m; });
      setRatingMap(prev => { const m = new Map(prev); m.delete(outfitIdx); return m; });
      setVariantMap(prev => { const m = new Map(prev); m.delete(outfitIdx); return m; });
    }
    setRefreshingIdx(null);
  }

  async function saveOutfit(outfitIdx: number) {
    const outfit = outfits[outfitIdx];
    const selectedVariant = variantMap.get(outfitIdx) ?? 0;
    const variant = outfit.variants?.[selectedVariant];
    if (!variant) return;

    setSaveMap(prev => new Map([...prev, [outfitIdx, "saving"]]));
    const allItemIds = [...outfit.core_item_ids, ...variant.item_ids];
    const r = await fetch("/api/outfits/history", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_ids: allItemIds, occasion, season, style_rationale: `${outfit.name || ""}||${variant.label || ""}||${variant.rationale}` }),
    });
    const d = await r.json();
    setSaveMap(prev => new Map([...prev, [outfitIdx, "saved"]]));
    setWornMap(prev => new Map([...prev, [outfitIdx, d.entry?.id ?? ""]]));
  }

  useEffect(() => {
    if (didAutoGenerate.current) return;
    const params  = new URLSearchParams(window.location.search);
    const occ     = params.get("occasion") as Occasion | null;
    const sea     = params.get("season")   as Season   | null;
    const wth     = params.get("weather");

    const resolvedOcc = occ && OCCASIONS.find(o => o.value === occ) ? occ : "casual";
    const resolvedSea = sea && SEASONS.find(s => s.value === sea)   ? sea : getCurrentSeason();
    const resolvedWth = wth || null;

    if (occ) { setOccasion(resolvedOcc); setShowControls(false); }
    if (sea)  setSeason(resolvedSea);
    if (resolvedWth) {
      setWeather(resolvedWth);
    } else {
      try {
        const cached = localStorage.getItem("dripson_weather");
        if (cached) {
          const { value, ts } = JSON.parse(cached);
          if (Date.now() - ts < 3_600_000) { setWeather(value); } else throw new Error("stale");
        } else throw new Error("miss");
      } catch {
        fetch("https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,weather_code&temperature_unit=fahrenheit")
          .then(r => r.json())
          .then(d => {
            const t = Math.round(d.current?.temperature_2m);
            if (!isNaN(t)) {
              const value = `${t}°F · NYC`;
              setWeather(value);
              try { localStorage.setItem("dripson_weather", JSON.stringify({ value, ts: Date.now() })); } catch { /* ignore */ }
            }
          }).catch(() => {});
      }
    }

    if (occ) { didAutoGenerate.current = true; generate({ occasion: resolvedOcc, season: resolvedSea, weather: resolvedWth }); }
  }, []);

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

  const currentOccasion = OCCASIONS.find(o => o.value === occasion);

  return (
    <>
    {toast && (
      <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", backgroundColor: "var(--c-fg)", color: "var(--c-bg)", padding: "10px 20px", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 600, zIndex: 100, whiteSpace: "nowrap", pointerEvents: "none", animation: "fadeInUp 200ms ease" }}>
        {toast}
      </div>
    )}
    <style>{`
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateX(-50%) translateY(8px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `}</style>
    <div className="page-content" style={{ maxWidth: "720px" }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: "2rem" }}>
        <p className="page-label">AI Stylist</p>
        <h1 className="page-title">Get Dressed</h1>
      </div>

      {/* Controls */}
      {!showControls ? (
        <div className="card anim-fade-up d-1" style={{ padding: "12px 18px", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {currentOccasion && <currentOccasion.Icon />}
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{currentOccasion?.label}</span>
            <span style={{ color: "var(--c-border-2)" }}>·</span>
            <span style={{ fontSize: "0.85rem", color: "var(--c-fg-muted)", textTransform: "capitalize" }}>{season}</span>
            {weather && <><span style={{ color: "var(--c-border-2)" }}>·</span><span style={{ fontSize: "0.85rem", color: "var(--c-fg-muted)" }}>{weather}</span></>}
          </div>
          <button onClick={() => setShowControls(true)} style={{ fontSize: "0.75rem", color: "var(--c-gold)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: 0 }}>Change</button>
        </div>
      ) : (
        <div className="card anim-fade-up d-1" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          {weather && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)" }}>Today</span>
              <span className="meta-pill">{weather}</span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
            <div>
              <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--c-fg-muted)", fontWeight: 700, marginBottom: "10px" }}>Occasion</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {OCCASIONS.map(({ value, label, Icon }) => (
                  <button key={value} onClick={() => setOccasion(value)} className={`chip${occasion === value ? " active" : ""}`} style={{ gap: "6px" }}>
                    <Icon />{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--c-fg-muted)", fontWeight: 700, marginBottom: "10px" }}>Season</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {SEASONS.map(({ value, label }) => (
                  <button key={value} onClick={() => setSeason(value)} className={`chip${season === value ? " active" : ""}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => generate()} disabled={loading} className="btn-primary" style={{ width: "100%", minHeight: "52px", fontSize: "0.8125rem" }}>
            {loading ? "Claude is styling your look..." : outfits.length > 0 ? "Regenerate" : "Generate Outfits"}
          </button>
        </div>
      )}

      {/* Regenerate button when controls collapsed */}
      {!showControls && (
        <button onClick={() => generate()} disabled={loading} className="btn-primary anim-fade-up d-2" style={{ width: "100%", minHeight: "52px", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
          {loading ? "Claude is styling your look..." : outfits.length > 0 ? "Regenerate All" : "Generate Outfits"}
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "var(--r-md)", padding: "14px 16px", color: "#991B1B", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          {error}
          {error.includes("Not enough") && (
            <a href="/wardrobe" style={{ display: "block", marginTop: "6px", color: "#991B1B", fontWeight: 600, textDecoration: "underline" }}>Go to wardrobe →</a>
          )}
        </div>
      )}

      {/* Outfit cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {loading
          ? [0, 1, 2].map(i => <OutfitSkeleton key={i} />)
          : outfits.map((outfit, i) => {
              const currentRating   = ratingMap.get(i) ?? 0;
              const selectedVariant = variantMap.get(i) ?? 0;
              const variant         = outfit.variants?.[selectedVariant];
              const saveState       = saveMap.get(i) ?? "idle";
              const isSaved         = saveState === "saved";
              const isRefreshing    = refreshingIdx === i;

              return (
                <div key={i} className="card anim-fade-up" style={{ overflow: "hidden", padding: 0, opacity: isRefreshing ? 0.5 : 1, transition: "opacity 200ms" }}>

                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 700 }}>
                        {outfit.name || `Look ${i + 1}`}
                      </span>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--c-gold)", backgroundColor: "var(--c-gold-bg)", border: "1px solid #E8D9A0", padding: "3px 9px", borderRadius: "var(--r-sm)" }}>
                        {outfit.rating}/10
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {/* Per-card refresh */}
                      <button
                        onClick={() => !isRefreshing && refreshSingle(i)}
                        disabled={isRefreshing || refreshingIdx !== null}
                        title="Get a different outfit"
                        style={{ width: "32px", height: "32px", borderRadius: "var(--r-sm)", border: "1.5px solid var(--c-border)", backgroundColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: isRefreshing ? "default" : "pointer", color: "var(--c-fg-muted)", transition: "all 150ms" }}
                      >
                        <RefreshIcon spinning={isRefreshing} />
                      </button>
                      {/* Save to History */}
                      <button
                        onClick={() => !isSaved && saveOutfit(i)}
                        disabled={saveState === "saving"}
                        style={{ padding: "5px 14px", borderRadius: "var(--r-sm)", fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit", cursor: isSaved ? "default" : "pointer", transition: "all 150ms", border: isSaved ? "1.5px solid #86EFAC" : "1.5px solid var(--c-border)", backgroundColor: isSaved ? "#F0FDF4" : "transparent", color: isSaved ? "#166534" : "var(--c-fg-soft)" }}
                      >
                        {saveState === "saving" ? "Saving…" : isSaved ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ padding: "1.25rem 1.5rem" }}>

                    {/* Core items */}
                    <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)", marginBottom: "10px" }}>The Base</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px", marginBottom: "1.25rem" }}>
                      {outfit.core_items.map(item => (
                        <div key={item.id} style={{ textAlign: "center" }}>
                          <div style={{ aspectRatio: "3/4", borderRadius: "var(--r-sm)", overflow: "hidden", border: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)" }}>
                            <img src={item.image_url} alt={item.subcategory || item.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <p style={{ fontSize: "0.65rem", color: "var(--c-fg-muted)", marginTop: "6px", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subcategory || item.category}</p>
                          <p style={{ fontSize: "0.6rem", color: "var(--c-fg-subtle)", textTransform: "capitalize" }}>{item.color}</p>
                        </div>
                      ))}
                    </div>

                    {/* Variant tabs */}
                    {outfit.variants?.length > 0 && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                          <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)", flexShrink: 0 }}>Finish With</p>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {outfit.variants.map((v, vi) => (
                              <button key={vi} onClick={() => setVariantMap(prev => new Map([...prev, [i, vi]]))}
                                style={{ padding: "4px 14px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", transition: "all 150ms", border: selectedVariant === vi ? "1.5px solid var(--c-fg)" : "1.5px solid var(--c-border)", backgroundColor: selectedVariant === vi ? "var(--c-fg)" : "transparent", color: selectedVariant === vi ? "var(--c-bg)" : "var(--c-fg-soft)" }}>
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {variant && (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "10px", marginBottom: "1.25rem" }}>
                              {variant.items.map(item => (
                                <div key={item.id} style={{ textAlign: "center" }}>
                                  <div style={{ aspectRatio: (item.category === "shoes" || item.category === "accessory") ? "1/1" : "3/4", borderRadius: "var(--r-sm)", overflow: "hidden", border: "1.5px solid var(--c-fg)", backgroundColor: "var(--c-surface-2)" }}>
                                    <img src={item.image_url} alt={item.subcategory || item.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  </div>
                                  <p style={{ fontSize: "0.65rem", color: "var(--c-fg-muted)", marginTop: "6px", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subcategory || item.category}</p>
                                  <p style={{ fontSize: "0.6rem", color: "var(--c-fg-subtle)", textTransform: "capitalize" }}>{item.color}</p>
                                </div>
                              ))}
                            </div>

                            <p style={{ fontSize: "0.875rem", color: "var(--c-fg-soft)", lineHeight: 1.7, marginBottom: "1rem" }}>{variant.rationale}</p>

                            <div className="gold-bar" style={{ marginBottom: "1rem" }}>
                              <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-muted)", lineHeight: 1.65 }}>
                                <span style={{ fontWeight: 600, color: "var(--c-fg)" }}>Style tip: </span>
                                {variant.style_tip}
                              </p>
                            </div>

                            {isSaved && (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={() => rate(i, 5)} style={{ display: "flex", alignItems: "center", padding: "5px 14px", borderRadius: "var(--r-sm)", border: `1.5px solid ${currentRating === 5 ? "#86EFAC" : "var(--c-border)"}`, backgroundColor: currentRating === 5 ? "#F0FDF4" : "transparent", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: 500, color: currentRating === 5 ? "#166534" : "var(--c-fg-muted)", transition: "all 150ms" }}>
                                  👍 Like
                                </button>
                                <button onClick={() => rate(i, 1)} style={{ display: "flex", alignItems: "center", padding: "5px 14px", borderRadius: "var(--r-sm)", border: `1.5px solid ${currentRating === 1 ? "#FECACA" : "var(--c-border)"}`, backgroundColor: currentRating === 1 ? "#FEF2F2" : "transparent", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", fontWeight: 500, color: currentRating === 1 ? "#991B1B" : "var(--c-fg-muted)", transition: "all 150ms" }}>
                                  👎 Dislike
                                </button>
                              </div>
                            )}
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
    </>
  );
}
