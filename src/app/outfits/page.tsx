"use client";

import { useState, useEffect, useRef } from "react";
import type { Occasion, Season, ClothingItem } from "@/lib/types";

const OCCASIONS: { value: Occasion; label: string; icon: string }[] = [
  { value: "casual",    label: "Casual",     icon: "☀️" },
  { value: "work",      label: "Work",        icon: "💼" },
  { value: "date_night",label: "Date Night",  icon: "✦" },
  { value: "workout",   label: "Workout",     icon: "⚡" },
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

interface OutfitResult {
  name: string;
  item_ids: string[];
  items: ClothingItem[];
  rating: number;
  rationale: string;
  style_tip: string;
}

export default function OutfitsPage() {
  const [occasion, setOccasion]     = useState<Occasion>("casual");
  const [season, setSeason]         = useState<Season>(getCurrentSeason());
  const [loading, setLoading]       = useState(false);
  const [outfits, setOutfits]       = useState<OutfitResult[]>([]);
  const [error, setError]           = useState("");
  const [weather, setWeather]       = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  // index → history entry id
  const [wornMap, setWornMap]       = useState<Map<number, string>>(new Map());
  // index → rating (5=like, 1=dislike, 0=none)
  const [ratingMap, setRatingMap]   = useState<Map<number, number>>(new Map());
  const didAutoGenerate             = useRef(false);
  // ratings clicked before the history entry was saved — applied once ID arrives
  const pendingRatings              = useRef<Map<number, number>>(new Map());

  // When wornMap gains a new entry ID, flush any pending rating for that index
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

    setLoading(true);
    setError("");
    setOutfits([]);
    setWornMap(new Map());
    setRatingMap(new Map());
    pendingRatings.current.clear();

    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occasion: occ, season: sea, weather: wth }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to generate outfits");
      setLoading(false);
      return;
    }

    const generated: OutfitResult[] = data.outfits;
    setOutfits(generated);
    setLoading(false);

    // Auto-save each outfit to history in background
    generated.forEach(async (outfit, idx) => {
      const r = await fetch("/api/outfits/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_ids: outfit.item_ids,
          occasion: occ,
          season: sea,
          style_rationale: `${outfit.name || ""}||${outfit.rationale}`,
        }),
      });
      const d = await r.json();
      setWornMap(prev => new Map([...prev, [idx, d.entry?.id ?? ""]]));
    });
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
    if (sea)   setSeason(resolvedSea);
    if (resolvedWth) {
      setWeather(resolvedWth);
    } else {
      fetch("https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,weather_code&temperature_unit=fahrenheit")
        .then(r => r.json())
        .then(d => { const t = Math.round(d.current?.temperature_2m); if (!isNaN(t)) setWeather(`${t}°F · NYC`); })
        .catch(() => {});
    }

    if (occ) {
      didAutoGenerate.current = true;
      generate({ occasion: resolvedOcc, season: resolvedSea, weather: resolvedWth });
    }
  }, []);

  async function rate(index: number, value: number) {
    const entryId  = wornMap.get(index);
    const current  = ratingMap.get(index) ?? 0;
    const newRating = current === value ? 0 : value;
    setRatingMap(prev => new Map([...prev, [index, newRating]]));

    if (entryId) {
      await fetch("/api/outfits/rate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entryId, rating: newRating }),
      });
    } else {
      // Entry not yet saved — queue for when ID arrives
      pendingRatings.current.set(index, newRating);
    }
  }

  const currentOccasion = OCCASIONS.find(o => o.value === occasion);

  return (
    <div className="page-content" style={{ maxWidth: "720px" }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: "2rem" }}>
        <p className="page-label">AI Stylist</p>
        <h1 className="page-title">Get Dressed</h1>
      </div>

      {/* Controls — compact bar or full card */}
      {!showControls ? (
        <div className="card anim-fade-up d-1" style={{ padding: "12px 18px", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1rem" }}>{currentOccasion?.icon}</span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--c-fg)" }}>{currentOccasion?.label}</span>
            <span style={{ color: "var(--c-border-2)" }}>·</span>
            <span style={{ fontSize: "0.85rem", color: "var(--c-fg-muted)", textTransform: "capitalize" }}>{season}</span>
            {weather && <>
              <span style={{ color: "var(--c-border-2)" }}>·</span>
              <span style={{ fontSize: "0.85rem", color: "var(--c-fg-muted)" }}>{weather}</span>
            </>}
          </div>
          <button
            onClick={() => setShowControls(true)}
            style={{ fontSize: "0.75rem", color: "var(--c-gold)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: 0 }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="card anim-fade-up d-1" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          {weather && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)" }}>Today</span>
              <span style={{ fontSize: "0.75rem", color: "var(--c-fg-soft)", fontWeight: 500, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", padding: "3px 10px", borderRadius: "100px" }}>
                {weather}
              </span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
            <div>
              <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--c-fg-muted)", fontWeight: 700, marginBottom: "10px" }}>Occasion</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {OCCASIONS.map(({ value, label, icon }) => (
                  <button key={value} onClick={() => setOccasion(value)} className={`chip${occasion === value ? " active" : ""}`} style={{ gap: "5px" }}>
                    <span>{icon}</span>{label}
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

      {/* Regenerate button when controls are collapsed */}
      {!showControls && (
        <button
          onClick={() => generate()}
          disabled={loading}
          className="btn-primary anim-fade-up d-2"
          style={{ width: "100%", minHeight: "52px", fontSize: "0.8125rem", marginBottom: "1.5rem" }}
        >
          {loading ? "Claude is styling your look..." : outfits.length > 0 ? "Regenerate" : "Generate Outfits"}
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
        {outfits.map((outfit, i) => {
          const currentRating = ratingMap.get(i) ?? 0;
          const isSaved       = wornMap.has(i);

          return (
            <div key={i} className="card anim-fade-up" style={{ overflow: "hidden", padding: 0 }}>

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

                {/* Like / Dislike — always shown immediately */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button
                    onClick={() => rate(i, 5)}
                    title={isSaved ? "Like" : "Like (saving…)"}
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "5px 12px", borderRadius: "var(--r-sm)",
                      border: `1.5px solid ${currentRating === 5 ? "#86EFAC" : "var(--c-border)"}`,
                      backgroundColor: currentRating === 5 ? "#F0FDF4" : "transparent",
                      cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit",
                      color: currentRating === 5 ? "#166534" : "var(--c-fg-soft)",
                      transition: "all 150ms",
                      opacity: 1,
                    }}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => rate(i, 1)}
                    title={isSaved ? "Dislike" : "Dislike (saving…)"}
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "5px 12px", borderRadius: "var(--r-sm)",
                      border: `1.5px solid ${currentRating === 1 ? "#FECACA" : "var(--c-border)"}`,
                      backgroundColor: currentRating === 1 ? "#FEF2F2" : "transparent",
                      cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit",
                      color: currentRating === 1 ? "#991B1B" : "var(--c-fg-soft)",
                      transition: "all 150ms",
                    }}
                  >
                    👎
                  </button>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "12px", marginBottom: "1.25rem" }}>
                  {outfit.items.map(item => (
                    <div key={item.id} style={{ textAlign: "center" }}>
                      <div style={{ aspectRatio: "3/4", borderRadius: "var(--r-sm)", overflow: "hidden", border: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)" }}>
                        <img src={item.image_url} alt={item.subcategory || item.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <p style={{ fontSize: "0.65rem", color: "var(--c-fg-muted)", marginTop: "6px", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.subcategory || item.category}
                      </p>
                      <p style={{ fontSize: "0.6rem", color: "var(--c-fg-subtle)", textTransform: "capitalize" }}>{item.color}</p>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: "0.875rem", color: "var(--c-fg-soft)", lineHeight: 1.7, marginBottom: "1rem" }}>
                  {outfit.rationale}
                </p>

                <div className="gold-bar">
                  <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-muted)", lineHeight: 1.65 }}>
                    <span style={{ fontWeight: 600, color: "var(--c-fg)" }}>Style tip: </span>
                    {outfit.style_tip}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
