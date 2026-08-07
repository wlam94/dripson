"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { OutfitHistoryEntry, ClothingItem } from "@/lib/types";

const OCCASIONS = [
  { value: "casual",     label: "Casual"    },
  { value: "work",       label: "Work"       },
  { value: "date_night", label: "Date Night" },
  { value: "workout",    label: "Workout"    },
];

const SEASONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall",   label: "Fall"   },
  { value: "winter", label: "Winter" },
];

const TOP_CATS = new Set(["shirt", "outerwear"]);
const BOT_CATS = new Set(["pants"]);

interface HistoryVariant {
  id: string;
  label: string;
  baseItems: ClothingItem[];
  finishItems: ClothingItem[];
  user_rating: number | null;
  occasion: string;
  season: string;
  rationale: string;
  wornCount: number;
}

interface GroupedEntry {
  groupId: string;
  name: string;
  worn_date: string;
  occasion: string;
  season: string;
  baseItems: ClothingItem[];
  variants: HistoryVariant[];
}

function groupHistoryEntries(entries: OutfitHistoryEntry[], labelFn: (o: string) => string): GroupedEntry[] {
  const groups = new Map<string, GroupedEntry>();

  for (const entry of entries) {
    const parts = (entry.style_rationale || "").split("||");
    let outfitName: string, variantLabel: string, rationale: string;
    if (parts.length >= 3) {
      // New format: name||label||rationale
      outfitName   = parts[0].trim() || labelFn(entry.occasion);
      variantLabel = parts[1].trim();
      rationale    = parts.slice(2).join("||");
    } else if (parts.length === 2) {
      // Old format: name||rationale
      outfitName   = parts[0].trim() || labelFn(entry.occasion);
      variantLabel = "";
      rationale    = parts[1];
    } else {
      outfitName   = labelFn(entry.occasion);
      variantLabel = "";
      rationale    = entry.style_rationale || "";
    }

    const allItems    = entry.items ?? [];
    const baseItems   = allItems.filter(it => TOP_CATS.has(it.category) || BOT_CATS.has(it.category));
    const finishItems = allItems.filter(it => !TOP_CATS.has(it.category) && !BOT_CATS.has(it.category));
    const shirt       = allItems.find(it => TOP_CATS.has(it.category));
    const pants       = allItems.find(it => BOT_CATS.has(it.category));

    const variant: HistoryVariant = {
      id: entry.id, label: variantLabel || outfitName, baseItems, finishItems,
      user_rating: entry.user_rating, occasion: entry.occasion,
      season: entry.season, rationale, wornCount: 1,
    };

    // Group only when BOTH shirt AND pants match
    const groupKey = shirt && pants ? `${shirt.id}|${pants.id}` : entry.id;

    if (groups.has(groupKey)) {
      const g       = groups.get(groupKey)!;
      const shirtId = shirt?.id ?? "";
      const shoesId = finishItems.find(it => it.category === "shoes")?.id ?? "";
      const existing = g.variants.find(v => {
        const vs    = v.baseItems.find(it => TOP_CATS.has(it.category))?.id ?? "";
        const vshoe = v.finishItems.find(it => it.category === "shoes")?.id ?? "";
        return vs === shirtId && vshoe === shoesId;
      });
      if (existing) {
        existing.wornCount++;
      } else {
        g.variants.push(variant);
      }
      if (new Date(entry.worn_date) > new Date(g.worn_date)) g.worn_date = entry.worn_date;
    } else {
      groups.set(groupKey, {
        groupId: groupKey, name: outfitName, worn_date: entry.worn_date,
        occasion: entry.occasion, season: entry.season, baseItems, variants: [variant],
      });
    }
  }
  return [...groups.values()];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ background: "white", borderRadius: "12px", padding: "14px", border: "1px solid var(--c-border)" }}>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px" }}>
        <div className="shimmer" style={{ width: "38px", height: "50px", borderRadius: "8px" }} />
        <div style={{ flex: 1 }}>
          <div className="shimmer" style={{ height: "13px", width: "55%", borderRadius: "4px", marginBottom: "8px" }} />
          <div className="shimmer" style={{ height: "9px", width: "35%", borderRadius: "4px" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "4px" }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="shimmer" style={{ flex: 1, height: "140px", borderRadius: "6px" }} />
        ))}
      </div>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16"
      fill={filled ? "#16a34a" : "none"}
      stroke={filled ? "#16a34a" : "currentColor"}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 4 18" width="4" height="18" fill="currentColor">
      <circle cx="2" cy="2"  r="1.6" />
      <circle cx="2" cy="9"  r="1.6" />
      <circle cx="2" cy="16" r="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

// ── OutfitCard (defined outside HistoryPage so React doesn't remount on re-render) ──

interface OutfitCardProps {
  group: GroupedEntry;
  faded?: boolean;
  selectedIdx: number;
  isExpanded: boolean;
  isMenuOpen: boolean;
  currentRating: number;
  isAnyLiked: boolean;
  onToggleExpand: () => void;
  onSelectVariant: (idx: number) => void;
  onToggleMenu: () => void;
  onRate: (id: string, rating: number) => void;
  onWearToday: (id: string) => void;
  onDelete: (id: string) => void;
  labelFn: (o: string) => string;
}

function OutfitCard({
  group, faded = false, selectedIdx, isExpanded, isMenuOpen, currentRating, isAnyLiked,
  onToggleExpand, onSelectVariant, onToggleMenu, onRate, onWearToday, onDelete, labelFn,
}: OutfitCardProps) {
  const cardInnerRef       = useRef<HTMLDivElement>(null);
  const touchStartX        = useRef(0);
  const touchStartY        = useRef(0);
  const swipeOffset        = useRef(0);
  const isHorizontalSwipe  = useRef(false);
  const [likeAnim, setLikeAnim]   = useState(false);
  const [swipeDir, setSwipeDir]   = useState<"left" | "right" | null>(null);

  const variant     = group.variants[selectedIdx];
  const allItems    = [...variant.baseItems, ...variant.finishItems];
  const d           = new Date(group.worn_date);
  const isToday     = d.toDateString() === new Date().toDateString();
  const hasVariants = group.variants.length > 1;

  function handleLike() {
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 420);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(30);
    onRate(variant.id, 5);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current       = e.touches[0].clientX;
    touchStartY.current       = e.touches[0].clientY;
    swipeOffset.current       = 0;
    isHorizontalSwipe.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    if (!isHorizontalSwipe.current) {
      isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontalSwipe.current) return;
    swipeOffset.current = dx;
    const clamped = Math.max(-80, Math.min(80, dx));
    if (cardInnerRef.current) {
      cardInnerRef.current.style.transform  = `translateX(${clamped}px)`;
      cardInnerRef.current.style.transition = "none";
    }
    setSwipeDir(dx > 12 ? "right" : dx < -12 ? "left" : null);
  }

  function handleTouchEnd() {
    const delta = swipeOffset.current;
    if (cardInnerRef.current) {
      cardInnerRef.current.style.transform  = "translateX(0)";
      cardInnerRef.current.style.transition = "transform 280ms cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    }
    setSwipeDir(null);
    if (isHorizontalSwipe.current) {
      if (delta > 60)  handleLike();
      else if (delta < -60) onDelete(variant.id);
    }
    swipeOffset.current       = 0;
    isHorizontalSwipe.current = false;
  }

  const catLabel = (c: string) =>
    ({ shirt: "Shirt", outerwear: "Layer", pants: "Pants", shoes: "Shoes", accessory: "Acc." }[c] ?? c);

  const likeBtn = (size: "sm" | "md") => (
    <button
      onClick={handleLike}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: size === "sm" ? "6px 16px" : "7px 18px",
        borderRadius: "var(--r-sm)",
        border: `1.5px solid ${currentRating === 5 ? "#86EFAC" : "var(--c-border)"}`,
        backgroundColor: currentRating === 5 ? "#F0FDF4" : "transparent",
        cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
        fontSize: size === "sm" ? "0.78rem" : "0.8rem",
        color: currentRating === 5 ? "#166534" : "var(--c-fg-muted)",
        transition: "all 150ms",
        animation: likeAnim ? "likeBounce 420ms ease-out" : "none",
      }}>
      <HeartIcon filled={currentRating === 5} />
      {currentRating === 5 ? "Liked" : "Like"}
    </button>
  );

  return (
    <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", opacity: faded ? 0.55 : 1 }}>

      {/* Swipe reveal: right = like, left = delete */}
      <div style={{
        position: "absolute", inset: 0, background: "#F0FDF4",
        display: "flex", alignItems: "center", paddingLeft: "22px", gap: "8px",
        opacity: swipeDir === "right" ? 1 : 0, transition: "opacity 80ms", pointerEvents: "none",
      }}>
        <HeartIcon filled />
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534" }}>Like</span>
      </div>
      <div style={{
        position: "absolute", inset: 0, background: "#FEF2F2",
        display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "22px", gap: "8px",
        opacity: swipeDir === "left" ? 1 : 0, transition: "opacity 80ms", pointerEvents: "none",
      }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#991B1B" }}>Delete</span>
        <span style={{ color: "#991B1B" }}><TrashIcon /></span>
      </div>

      {/* Card body — slides on swipe */}
      <div
        ref={cardInnerRef}
        className="card"
        style={{
          overflow: "hidden", padding: 0, position: "relative",
          borderLeft: `4px solid ${isAnyLiked ? "#4ADE80" : "transparent"}`,
          transition: "border-left-color 300ms",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >

        {/* ── Header ── */}
        <div
          onClick={onToggleExpand}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", padding: "11px 12px 10px" }}
        >
          {/* Date pill */}
          <div style={{
            flexShrink: 0, backgroundColor: isToday ? "var(--c-fg)" : "var(--c-surface-2)",
            border: "1px solid var(--c-border)", borderRadius: "8px",
            padding: "5px 8px", textAlign: "center", minWidth: "34px",
          }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, lineHeight: 1, color: isToday ? "var(--c-bg)" : "var(--c-fg)" }}>
              {d.getDate()}
            </p>
            <p style={{ fontSize: "0.44rem", color: isToday ? "var(--c-bg)" : "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "1px" }}>
              {isToday ? "Today" : d.toLocaleDateString("en-US", { month: "short" })}
            </p>
          </div>

          {/* Name + badges */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--c-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.name}
            </p>
            <div style={{ display: "flex", gap: "4px", marginTop: "3px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.58rem", padding: "2px 7px", borderRadius: "100px", backgroundColor: "var(--c-surface-2)", color: "var(--c-fg-muted)", textTransform: "capitalize", border: "1px solid var(--c-border)", fontWeight: 500 }}>
                {group.season}
              </span>
              <span style={{ fontSize: "0.58rem", padding: "2px 7px", borderRadius: "100px", backgroundColor: "var(--c-surface-2)", color: "var(--c-fg-muted)", textTransform: "capitalize", border: "1px solid var(--c-border)", fontWeight: 500 }}>
                {labelFn(group.occasion)}
              </span>
              {isAnyLiked && (
                <span style={{ fontSize: "0.58rem", padding: "2px 8px", borderRadius: "100px", backgroundColor: "#F0FDF4", border: "1px solid #86EFAC", color: "#166534", fontWeight: 700 }}>
                  ♥ Liked
                </span>
              )}
              {group.variants.length > 1 && (
                <span style={{ fontSize: "0.58rem", padding: "2px 8px", borderRadius: "100px", backgroundColor: "var(--c-surface-2)", color: "var(--c-fg-muted)", border: "1px solid var(--c-border)", fontWeight: 500 }}>
                  {group.variants.length} looks
                </span>
              )}
            </div>
          </div>

          {/* Wear Today direct button */}
          <button
            title="Wear Today"
            onClick={e => { e.stopPropagation(); onWearToday(variant.id); }}
            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "6px", color: "var(--c-fg-muted)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <CalendarIcon />
          </button>

          {/* Chevron */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-fg-muted)" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 250ms" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>

          {/* Dots menu trigger */}
          <button
            onClick={e => { e.stopPropagation(); onToggleMenu(); }}
            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: "var(--c-fg-muted)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <DotsIcon />
          </button>
        </div>

        {/* Dropdown menu */}
        {isMenuOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", top: "50px", right: "12px", backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)", borderRadius: "10px", padding: "6px", zIndex: 30, minWidth: "140px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
            <button
              onClick={() => { onDelete(variant.id); onToggleMenu(); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: "6px", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", color: "#991B1B", fontWeight: 500 }}>
              <TrashIcon /> Delete
            </button>
          </div>
        )}

        {/* ── Photo strip with category labels ── */}
        <div style={{ display: "flex", gap: "4px", padding: "0 12px 12px" }}>
          {allItems.slice(0, 5).map(item => (
            <div key={item.id} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
              <div style={{ height: "140px", borderRadius: "8px", overflow: "hidden", backgroundColor: "var(--c-surface-2)", border: "1px solid var(--c-border)" }}>
                <img src={item.image_url} alt={item.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
              </div>
              <p style={{ fontSize: "0.48rem", textAlign: "center", color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                {catLabel(item.category)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Variant tabs ── */}
        {hasVariants && (
          <div style={{ display: "flex", gap: "6px", padding: "0 12px 10px", flexWrap: "wrap" }}>
            {group.variants.map((v, vi) => (
              <button key={vi}
                onClick={() => onSelectVariant(vi)}
                style={{
                  padding: "4px 14px", borderRadius: "100px", fontSize: "0.7rem", fontWeight: 600,
                  fontFamily: "inherit", cursor: "pointer", transition: "all 150ms",
                  border: selectedIdx === vi ? "1.5px solid var(--c-fg)" : "1.5px solid var(--c-border)",
                  backgroundColor: selectedIdx === vi ? "var(--c-fg)" : "transparent",
                  color: selectedIdx === vi ? "var(--c-bg)" : "var(--c-fg-soft)",
                }}>
                {v.label}{v.wornCount > 1 ? <span style={{ opacity: 0.6, fontSize: "0.6rem", marginLeft: "4px" }}>×{v.wornCount}</span> : null}
              </button>
            ))}
          </div>
        )}

        {/* ── Like / Dislike (always visible) ── */}
        <div style={{ padding: "0 12px 13px", display: "flex", gap: "6px" }}>
          {likeBtn("sm")}
          <button
            onClick={() => onRate(variant.id, currentRating === 1 ? 0 : 1)}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "6px 14px", borderRadius: "var(--r-sm)", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 500, fontSize: "0.78rem", transition: "all 150ms",
              border: `1.5px solid ${currentRating === 1 ? "#FECACA" : "var(--c-border)"}`,
              backgroundColor: currentRating === 1 ? "#FEF2F2" : "transparent",
              color: currentRating === 1 ? "#991B1B" : "var(--c-fg-muted)",
            }}>
            {currentRating === 1 ? "Didn't Work" : "Nope"}
          </button>
        </div>

        {/* ── Expanded detail (grid animation for accurate height) ── */}
        <div style={{
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 320ms ease",
        }}>
          <div style={{ overflow: "hidden" }}>
            <div style={{ opacity: isExpanded ? 1 : 0, transition: "opacity 220ms ease", borderTop: "1px solid var(--c-border)", padding: "14px" }}>
              {variant.baseItems.length > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)", marginBottom: "8px" }}>The Base</p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {variant.baseItems.map(item => (
                      <div key={item.id} style={{ flex: 1, aspectRatio: "3/4", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--c-border)", backgroundColor: "var(--c-surface-2)" }}>
                        <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {variant.finishItems.length > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-fg-muted)", marginBottom: "8px" }}>The Finish</p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {variant.finishItems.map(item => (
                      <div key={item.id} style={{ flex: 1, aspectRatio: item.category === "shoes" || item.category === "accessory" ? "1/1" : "3/4", borderRadius: "8px", overflow: "hidden", border: "1.5px solid var(--c-fg)", backgroundColor: "var(--c-surface-2)" }}>
                        <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {variant.rationale && (
                <div style={{ borderLeft: "3px solid var(--c-border)", paddingLeft: "12px", marginBottom: "14px" }}>
                  <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-soft)", lineHeight: 1.7, fontStyle: "italic" }}>{variant.rationale}</p>
                </div>
              )}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {likeBtn("md")}
                <button
                  onClick={() => onRate(variant.id, currentRating === 1 ? 0 : 1)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "7px 16px", borderRadius: "var(--r-sm)", cursor: "pointer",
                    fontFamily: "inherit", fontWeight: 500, fontSize: "0.8rem", transition: "all 150ms",
                    border: `1.5px solid ${currentRating === 1 ? "#FECACA" : "var(--c-border)"}`,
                    backgroundColor: currentRating === 1 ? "#FEF2F2" : "transparent",
                    color: currentRating === 1 ? "#991B1B" : "var(--c-fg-muted)",
                  }}>
                  {currentRating === 1 ? "Didn't Work" : "Nope"}
                </button>
              </div>
              {currentRating === 5 && (
                <a href={`/outfits?occasion=${variant.occasion}&season=${variant.season}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "14px", fontSize: "0.8rem", fontWeight: 600, color: "var(--c-fg)", textDecoration: "none", border: "1.5px solid var(--c-fg)", borderRadius: "var(--r-sm)", padding: "10px 14px", transition: "opacity 150ms" }}>
                  Generate similar look →
                </a>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [entries, setEntries]               = useState<OutfitHistoryEntry[]>([]);
  const [loading, setLoading]               = useState(true);
  const [localRatings, setLocalRatings]     = useState<Map<string, number>>(new Map());
  const [activeSeason, setActiveSeason]     = useState<string | null>(null);
  const [activeOccasion, setActiveOccasion] = useState<string | null>(null);
  const [sortBy, setSortBy]                 = useState<"newest" | "rated">("newest");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu]             = useState<string | null>(null);
  const [variantMap, setVariantMap]         = useState<Map<string, number>>(new Map());
  const [deletedIds, setDeletedIds]         = useState<Set<string>>(new Set());
  const [showDisliked, setShowDisliked]     = useState(false);
  const [toast, setToast]                   = useState<string | null>(null);
  const [search, setSearch]                 = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const occ = params.get("occasion");
    if (occ) setActiveOccasion(occ);

    async function load() {
      // Fetch history and wardrobe in parallel
      const [{ data: history }, { data: items }] = await Promise.all([
        getSupabase().from("outfit_history").select("*").order("worn_date", { ascending: false }),
        getSupabase().from("clothing_items").select("*"),
      ]);
      if (!history?.length) { setLoading(false); return; }
      const itemMap = new Map((items || []).map((i: ClothingItem) => [i.id, i]));
      setEntries(history.map((h: OutfitHistoryEntry) => ({
        ...h,
        items: h.item_ids.map((id: string) => itemMap.get(id)).filter(Boolean) as ClothingItem[],
      })));
      setLoading(false);
    }
    load();
  }, []);

  // Close open menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    function handler() { setOpenMenu(null); }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenu]);

  const label = useCallback((o: string) =>
    o.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()), []);

  async function rate(id: string, rating: number) {
    const current = localRatings.get(id) ?? 0;
    const next = current === rating ? 0 : rating;
    setLocalRatings(prev => new Map([...prev, [id, next]]));
    const r = await fetch("/api/outfits/rate", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rating: next }),
    });
    const d = await r.json();
    if (d.should_update_profile) {
      fetch("/api/style-profile", { method: "POST" })
        .then(res => res.ok && showToast("Style profile updated"))
        .catch(() => {});
    }
  }

  async function deleteVariant(variantId: string) {
    setDeletedIds(prev => new Set([...prev, variantId]));
    setEntries(prev => prev.filter(e => e.id !== variantId));
    await fetch(`/api/outfits/history/${variantId}`, { method: "DELETE" });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function wearToday(variantId: string) {
    const today = new Date().toISOString();
    setEntries(prev => prev.map(e => e.id === variantId ? { ...e, worn_date: today } : e));
    showToast("Marked as worn today ✓");
    await fetch(`/api/outfits/history/${variantId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worn_date: today }),
    });
  }

  // ── Derived data ──
  const visibleEntries = entries.filter(e => !deletedIds.has(e.id));
  const sorted = [...visibleEntries].sort((a, b) => new Date(b.worn_date).getTime() - new Date(a.worn_date).getTime());
  const allGrouped = groupHistoryEntries(sorted, label);

  const getEffectiveRating = (group: GroupedEntry) => {
    const vi = variantMap.get(group.groupId) ?? 0;
    const v  = group.variants[vi];
    return v ? (localRatings.get(v.id) ?? v.user_rating ?? 0) : 0;
  };

  const nonDisliked    = allGrouped.filter(g => getEffectiveRating(g) !== 1);
  const dislikedGroups = allGrouped.filter(g => getEffectiveRating(g) === 1);

  const mainGroups = nonDisliked.filter(g => {
    if (!activeOccasion && !activeSeason) return true;
    return g.variants.some(v =>
      (!activeOccasion || v.occasion === activeOccasion) &&
      (!activeSeason   || v.season   === activeSeason)
    );
  });

  if (sortBy === "rated") {
    mainGroups.sort((a, b) => (getEffectiveRating(b) === 5 ? 1 : 0) - (getEffectiveRating(a) === 5 ? 1 : 0));
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredGroups = !searchTerm ? mainGroups : mainGroups.filter(g => {
    if (g.name.toLowerCase().includes(searchTerm)) return true;
    return g.variants.some(v =>
      [...v.baseItems, ...v.finishItems].some(item =>
        (item.subcategory || item.category).toLowerCase().includes(searchTerm) ||
        item.color.toLowerCase().includes(searchTerm)
      )
    );
  });

  const seasonCounts: Record<string, number>   = {};
  const occasionCounts: Record<string, number> = {};
  nonDisliked.forEach(g => {
    new Set(g.variants.map(v => v.season)).forEach(s   => { seasonCounts[s]   = (seasonCounts[s]   || 0) + 1; });
    new Set(g.variants.map(v => v.occasion)).forEach(o => { occasionCounts[o] = (occasionCounts[o] || 0) + 1; });
  });

  function cardProps(group: GroupedEntry) {
    const selectedIdx = variantMap.get(group.groupId) ?? 0;
    const v = group.variants[selectedIdx];
    const isAnyLiked = group.variants.some(vv => (localRatings.get(vv.id) ?? vv.user_rating ?? 0) === 5);
    return {
      selectedIdx,
      isExpanded:    expandedGroups.has(group.groupId),
      isMenuOpen:    openMenu === group.groupId,
      currentRating: localRatings.get(v.id) ?? v.user_rating ?? 0,
      isAnyLiked,
      onToggleExpand: () => setExpandedGroups(prev => {
        const next = new Set(prev);
        next.has(group.groupId) ? next.delete(group.groupId) : next.add(group.groupId);
        return next;
      }),
      onSelectVariant: (idx: number) => setVariantMap(prev => new Map([...prev, [group.groupId, idx]])),
      onToggleMenu:    () => setOpenMenu(openMenu === group.groupId ? null : group.groupId),
      onRate:     rate,
      onWearToday: wearToday,
      onDelete:    deleteVariant,
      labelFn:     label,
    };
  }

  const generateHref = `/outfits${activeOccasion ? `?occasion=${activeOccasion}` : ""}`;

  // ── Render ──
  return (
    <>
      {toast && (
        <div style={{
          position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "var(--c-fg)", color: "var(--c-bg)", padding: "10px 20px",
          borderRadius: "100px", fontSize: "0.8rem", fontWeight: 600, zIndex: 100,
          whiteSpace: "nowrap", pointerEvents: "none",
          animation: "fadeInUp 200ms ease",
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div className="page-content" style={{ maxWidth: "640px" }}>

        {/* ── Header ── */}
        <div className="anim-fade-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <p className="page-label">Log</p>
            <h1 className="page-title">Outfits</h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
            {nonDisliked.length > 0 && (
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "2.25rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }}>
                  {mainGroups.length}
                  {(activeOccasion || activeSeason) && nonDisliked.length !== mainGroups.length && (
                    <span style={{ fontSize: "1rem", color: "var(--c-fg-muted)", fontWeight: 400 }}>/{nonDisliked.length}</span>
                  )}
                </p>
                <p style={{ fontSize: "0.6rem", color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>outfits</p>
              </div>
            )}
            {nonDisliked.length > 1 && (
              <button onClick={() => setSortBy(s => s === "newest" ? "rated" : "newest")}
                style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--c-fg-muted)", background: "none", border: "1px solid var(--c-border)", borderRadius: "100px", padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                {sortBy === "newest" ? "↓ Newest" : "★ Liked first"}
              </button>
            )}
          </div>
        </div>

        {/* ── Search ── */}
        {!loading && nonDisliked.length > 0 && (
          <div className="anim-fade-up d-1" style={{ position: "relative", marginBottom: "1rem" }}>
            <svg style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, item, or color..."
              className="search-input"
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: "13px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--c-fg-muted)", fontSize: "1.1rem", lineHeight: 1, padding: "2px" }}>×</button>
            )}
          </div>
        )}

        {/* ── Sticky filter chips ── */}
        {!loading && nonDisliked.length > 0 && (
          <div style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--c-bg)", paddingBottom: "12px", marginBottom: "4px" }}>
            {/* Season chips */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", scrollbarWidth: "none", paddingBottom: "6px" }}>
              {[{ value: null as string | null, label: "All seasons" }, ...SEASONS].map(({ value, label: lbl }) => {
                const count    = value ? (seasonCounts[value] || 0) : nonDisliked.length;
                const isActive = activeSeason === value;
                if (value && !count) return null;
                return (
                  <button key={String(value)} onClick={() => setActiveSeason(value)}
                    style={{ padding: "5px 13px", fontSize: "0.73rem", fontWeight: isActive ? 700 : 500, fontFamily: "inherit", cursor: "pointer", flexShrink: 0, borderRadius: "100px", border: `1.5px solid ${isActive ? "var(--c-fg)" : "var(--c-border)"}`, background: isActive ? "var(--c-fg)" : "transparent", color: isActive ? "var(--c-bg)" : "var(--c-fg-soft)", transition: "all 150ms", whiteSpace: "nowrap" }}>
                    {lbl}{value && count ? ` · ${count}` : ""}
                  </button>
                );
              })}
            </div>
            {/* Occasion chips */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", scrollbarWidth: "none" }}>
              {[{ value: null as string | null, label: "All occasions" }, ...OCCASIONS].map(({ value, label: lbl }) => {
                const count    = value ? (occasionCounts[value] || 0) : nonDisliked.length;
                const isActive = activeOccasion === value;
                if (value && !count) return null;
                return (
                  <button key={String(value)} onClick={() => setActiveOccasion(value)}
                    style={{ padding: "5px 13px", fontSize: "0.73rem", fontWeight: isActive ? 700 : 500, fontFamily: "inherit", cursor: "pointer", flexShrink: 0, borderRadius: "100px", border: `1.5px solid ${isActive ? "var(--c-fg)" : "var(--c-border)"}`, background: isActive ? "var(--c-fg)" : "transparent", color: isActive ? "var(--c-bg)" : "var(--c-fg-soft)", transition: "all 150ms", whiteSpace: "nowrap" }}>
                    {lbl}{value && count ? ` · ${count}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>

        ) : entries.length === 0 ? (
          <div className="anim-scale-in" style={{ textAlign: "center", padding: "6rem 0" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", marginBottom: "6px", fontWeight: 600 }}>No outfits logged yet.</p>
            <p style={{ color: "var(--c-fg-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Generate and save an outfit to start your log.</p>
            <a href="/outfits" className="btn-primary" style={{ textDecoration: "none" }}>Generate Outfit</a>
          </div>

        ) : filteredGroups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 600, marginBottom: "6px" }}>
              {search ? "No matches for that search." : "No matches."}
            </p>
            <p style={{ color: "var(--c-fg-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              {search ? "Try a different search term or clear the filter." : "Try a different filter or generate a new look."}
            </p>
            {search
              ? <button onClick={() => setSearch("")} className="btn-primary" style={{ fontSize: "0.875rem" }}>Clear search</button>
              : <a href={generateHref} className="btn-primary" style={{ textDecoration: "none", fontSize: "0.875rem" }}>Generate {activeOccasion ? label(activeOccasion) : ""} Outfit</a>
            }
          </div>

        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredGroups.map(group => (
                <OutfitCard key={group.groupId} group={group} {...cardProps(group)} />
              ))}
            </div>

            {/* Generate CTA at bottom of filtered list */}
            {!search && (activeOccasion || activeSeason) && (
              <a href={generateHref}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", margin: "1.5rem 0 0.5rem", padding: "13px", borderRadius: "var(--r-sm)", border: "1.5px dashed var(--c-border)", color: "var(--c-fg-muted)", fontSize: "0.8rem", fontWeight: 600, textDecoration: "none", transition: "border-color 150ms, color 150ms", fontFamily: "inherit" }}>
                + Generate New {activeOccasion ? label(activeOccasion) : ""} Look
              </a>
            )}

            {/* Disliked section */}
            {dislikedGroups.length > 0 && (
              <div style={{ marginTop: "2rem" }}>
                <button onClick={() => setShowDisliked(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "14px 0", background: "none", border: "none", borderTop: "1px solid var(--c-border)", cursor: "pointer", fontFamily: "inherit", color: "var(--c-fg-muted)", fontSize: "0.78rem", fontWeight: 600 }}>
                  <span style={{ fontSize: "0.7rem" }}>{showDisliked ? "▾" : "▸"}</span>
                  Didn&apos;t Work ({dislikedGroups.length})
                </button>
                {showDisliked && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                    {dislikedGroups.map(group => (
                      <OutfitCard key={group.groupId} group={group} faded {...cardProps(group)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </>
  );
}
