"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

function getCurrentSeason() {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

const OCCASIONS = [
  { value: "casual",     label: "Casual",     desc: "Everyday comfort, NYC-ready",    icon: "☀️" },
  { value: "work",       label: "Work",        desc: "Sharp enough for the office",    icon: "💼" },
  { value: "date_night", label: "Date Night",  desc: "Elevated, intentional",          icon: "✦"  },
  { value: "workout",    label: "Workout",     desc: "Performance meets style",        icon: "⚡" },
];

export default function Dashboard() {
  const [weather, setWeather]       = useState<string | null>(null);
  const [itemCount, setItemCount]   = useState<number | null>(null);
  const [outfitCount, setOutfitCount] = useState<number | null>(null);
  const season = getCurrentSeason();

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,weather_code&temperature_unit=fahrenheit")
      .then(r => r.json())
      .then(d => {
        const temp = Math.round(d.current?.temperature_2m);
        if (!isNaN(temp)) setWeather(`${temp}°F`);
      })
      .catch(() => {});

    getSupabase()
      .from("clothing_items")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .then(({ count }) => setItemCount(count ?? 0));

    getSupabase()
      .from("outfit_history")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setOutfitCount(count ?? 0));
  }, []);

  function occasionHref(occasion: string) {
    return `/history?occasion=${occasion}`;
  }

  return (
    <div className="page-content" style={{ maxWidth: "600px" }}>

      {/* Header */}
      <div className="anim-fade-up" style={{ marginBottom: "2rem" }}>
        <p className="page-label">AI Fashion Advisor · NYC</p>
        <h1 className="page-title">
          What&apos;s the{" "}
          <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--c-fg-soft)" }}>occasion?</em>
        </h1>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {weather && (
            <span style={{ fontSize: "0.75rem", color: "var(--c-fg-soft)", fontWeight: 500, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", padding: "4px 12px", borderRadius: "100px" }}>
              {weather} · NYC
            </span>
          )}
          <span style={{ fontSize: "0.75rem", color: "var(--c-fg-soft)", fontWeight: 500, backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", padding: "4px 12px", borderRadius: "100px", textTransform: "capitalize" }}>
            {season}
          </span>
        </div>
      </div>

      {/* Occasion cards — each auto-generates on arrival */}
      <div className="anim-fade-up d-1" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "2rem" }}>
        {OCCASIONS.map(({ value, label, desc, icon }) => (
          <Link key={value} href={occasionHref(value)} style={{ textDecoration: "none" }}>
            <div
              className="card"
              style={{ padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", transition: "box-shadow var(--t-fast) var(--ease), transform var(--t-fast) var(--ease)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-md)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-sm)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, color: "var(--c-fg)", marginBottom: "2px" }}>{label}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--c-fg-muted)" }}>{desc}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="anim-fade-up d-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <Link href="/wardrobe" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "1.25rem", transition: "box-shadow var(--t-fast) var(--ease)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-md)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-sm)"; }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.25rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em", color: "var(--c-fg)" }}>
              {itemCount ?? "—"}
            </p>
            <p style={{ fontSize: "0.62rem", color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "6px" }}>Items in wardrobe</p>
          </div>
        </Link>
        <Link href="/history" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "1.25rem", transition: "box-shadow var(--t-fast) var(--ease)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-md)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--sh-sm)"; }}
          >
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.25rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em", color: "var(--c-fg)" }}>
              {outfitCount ?? "—"}
            </p>
            <p style={{ fontSize: "0.62rem", color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "6px" }}>Outfits logged</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
