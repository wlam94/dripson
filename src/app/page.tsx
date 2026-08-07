"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import OutfitSheet from "@/components/OutfitSheet";
import type { Occasion } from "@/lib/types";

function getCurrentSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}


function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

const OCCASIONS = [
  { value: "casual",     label: "Casual",     desc: "Everyday comfort, NYC-ready", Icon: SunIcon       },
  { value: "work",       label: "Work",        desc: "Sharp enough for the office", Icon: BriefcaseIcon },
  { value: "date_night", label: "Date Night",  desc: "Elevated, intentional",       Icon: StarIcon      },
  { value: "workout",    label: "Workout",     desc: "Performance meets style",     Icon: BoltIcon      },
];

const OCC_LABELS: Record<string, string> = {
  casual: "Casual", work: "Work", date_night: "Date Night", workout: "Workout",
};

interface WardrobeItem {
  id: string;
  category: string;
  occasions: string[];
}

function detectGap(items: WardrobeItem[]): string | null {
  if (items.length < 3) return null; // not enough to judge
  for (const { value, label } of OCCASIONS) {
    const occ = items.filter(i => Array.isArray(i.occasions) && i.occasions.includes(value));
    if (occ.length === 0) continue;
    if (!occ.some(i => i.category === "shoes"))                                    return `No shoes for ${OCC_LABELS[value] ?? label}`;
    if (!occ.some(i => i.category === "shirt" || i.category === "outerwear"))      return `No tops for ${OCC_LABELS[value] ?? label}`;
    if (!occ.some(i => i.category === "pants"))                                    return `No pants for ${OCC_LABELS[value] ?? label}`;
  }
  return null;
}

export default function Dashboard() {
  const [weather, setWeather]           = useState<string | null>(null);
  const [itemCount, setItemCount]       = useState<number | null>(null);
  const [outfitCount, setOutfitCount]   = useState<number | null>(null);
  const [styleInsight, setStyleInsight] = useState<string | null>(null);
  const [gapNudge, setGapNudge]         = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeOccasion, setActiveOccasion] = useState<Occasion | null>(null);
  const season = getCurrentSeason();

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,weather_code&temperature_unit=fahrenheit")
      .then(r => r.json())
      .then(d => { const t = Math.round(d.current?.temperature_2m); if (!isNaN(t)) setWeather(`${t}°F`); })
      .catch(() => {});

    const sb = getSupabase();
    Promise.all([
      sb.from("clothing_items").select("id, category, occasions").eq("is_active", true),
      sb.from("outfit_history").select("id", { count: "exact", head: true }),
      sb.from("style_profile").select("key_insights").eq("id", 1).single(),
    ]).then(([itemsRes, histRes, profileRes]) => {
      const items = (itemsRes.data ?? []) as WardrobeItem[];
      setItemCount(items.length);
      setOutfitCount(histRes.count ?? 0);
      setGapNudge(detectGap(items));
      if (profileRes.data?.key_insights) setStyleInsight(profileRes.data.key_insights);
      setStatsLoading(false);
    });
  }, []);

  return (
    <div className="page-content" style={{ maxWidth: "600px" }}>

      {/* ── Header ── */}
      <div className="anim-fade-up" style={{ marginBottom: "2.25rem" }}>

        {/* Weather + season pills */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {weather && <span className="meta-pill">{weather} · NYC</span>}
          <span className="meta-pill" style={{ textTransform: "capitalize" }}>{season}</span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 8vw, 2.75rem)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          color: "var(--c-fg)",
        }}>
          What&apos;s the <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--c-fg-soft)" }}>occasion?</em>
        </h1>

        {/* Style insight as editorial pull quote */}
        {styleInsight && (
          <div className="gold-bar" style={{ marginTop: "1.25rem" }}>
            <p style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: "0.9375rem",
              color: "var(--c-fg-soft)",
              lineHeight: 1.65,
            }}>
              {styleInsight}
            </p>
          </div>
        )}
      </div>

      {/* ── Occasion cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "2rem" }}>
        {OCCASIONS.map(({ value, label, desc, Icon }, i) => (
          <button
            key={value}
            onClick={() => setActiveOccasion(value)}
            className="card occasion-card anim-fade-up"
            style={{ animationDelay: `${80 + i * 75}ms`, width: "100%", textAlign: "left", background: "var(--c-surface)", outline: "none", cursor: "pointer" }}
          >
            <div className="occasion-icon">
              <Icon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.25rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "var(--c-fg)",
                marginBottom: "2px",
              }}>
                {label}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-muted)", lineHeight: 1.4 }}>{desc}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--c-fg-muted)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>

      {/* ── Outfit sheet ── */}
      {activeOccasion && (
        <OutfitSheet
          occasion={activeOccasion}
          season={season}
          weather={weather}
          onClose={() => setActiveOccasion(null)}
        />
      )}

      {/* ── Stats cards ── */}
      <div className="anim-fade-up d-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "1.25rem" }}>
        <Link href="/wardrobe" className="card stat-card" style={{ textDecoration: "none" }}>
          {statsLoading
            ? <div className="shimmer" style={{ height: "28px", width: "48px", borderRadius: "4px", marginBottom: "6px" }} />
            : <span className="stat-number">{itemCount ?? "—"}</span>
          }
          <span className="stat-label">Wardrobe Items</span>
        </Link>
        <Link href="/history" className="card stat-card" style={{ textDecoration: "none" }}>
          {statsLoading
            ? <div className="shimmer" style={{ height: "28px", width: "48px", borderRadius: "4px", marginBottom: "6px" }} />
            : <span className="stat-number">{outfitCount ?? "—"}</span>
          }
          <span className="stat-label">Outfits Saved</span>
        </Link>
      </div>

      {/* ── Gap nudge ── */}
      {gapNudge && (
        <Link href="/wardrobe" className="card" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "12px 16px",
          textDecoration: "none",
          transition: "border-color var(--t-base) var(--ease)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: "0.78rem", color: "var(--c-fg-soft)", fontWeight: 500 }}>
              Gap — {gapNudge}
            </span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--c-gold)", fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
            Add item →
          </span>
        </Link>
      )}

    </div>
  );
}
