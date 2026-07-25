"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const nav = [
  {
    href: "/",
    label: "Dashboard",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  },
  {
    href: "/upload",
    label: "Upload",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  },
  {
    href: "/wardrobe",
    label: "Wardrobe",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" /></svg>,
  },
  {
    href: "/outfits",
    label: "Outfits",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  },
  {
    href: "/history",
    label: "History",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  },
  {
    href: "/gaps",
    label: "Shopping Gaps",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
  },
];

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persist collapsed state and sync CSS variable for main content offset
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    const root = document.documentElement;
    if (collapsed) {
      root.setAttribute("data-sidebar-collapsed", "");
    } else {
      root.removeAttribute("data-sidebar-collapsed");
    }
  }, [collapsed]);

  const w = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <aside
      className="hidden md:flex flex-col fixed top-0 left-0 h-screen z-50"
      style={{
        width: `${w}px`,
        backgroundColor: "#0C0C0C",
        transition: "width 220ms cubic-bezier(0.25,0.1,0.25,1)",
        overflow: "hidden",
      }}
    >
      {/* ── Logo ── */}
      <div style={{ padding: collapsed ? "28px 0 20px" : "28px 20px 20px", textAlign: collapsed ? "center" : "left", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: collapsed ? "center" : "flex-start" }}>
          <div style={{ width: "30px", height: "30px", background: "#C5A028", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <h1 style={{ color: "#FFFFFF", fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, fontStyle: "italic", whiteSpace: "nowrap" }}>
                Dripson
              </h1>
              <p style={{ color: "#C5A028", fontFamily: "var(--font-body)", fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "3px", whiteSpace: "nowrap" }}>
                Personal Advisor
              </p>
            </div>
          )}
        </div>
        <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginTop: "20px" }} />
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: collapsed ? "0 8px" : "0 10px", display: "flex", flexDirection: "column", gap: "2px" }}>
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : "12px",
                padding: collapsed ? "10px 0" : "10px 14px",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "0.9375rem",
                fontWeight: active ? 600 : 400,
                backgroundColor: active ? "rgba(197,160,40,0.10)" : "transparent",
                color: active ? "#C5A028" : "rgba(255,255,255,0.55)",
                borderLeft: collapsed ? "none" : active ? "2px solid #C5A028" : "2px solid transparent",
                transition: "all 150ms",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }}>{icon}</span>
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer / Toggle ── */}
      <div style={{ padding: collapsed ? "16px 0" : "16px 20px", flexShrink: 0 }}>
        <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "14px" }} />
        {!collapsed && (
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", letterSpacing: "0.04em", lineHeight: 1.8, marginBottom: "14px" }}>
            Smart Casual · Business Casual<br />New York City
          </p>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: collapsed ? "40px" : "36px",
            height: "36px",
            margin: collapsed ? "0 auto" : "0",
            borderRadius: "8px",
            border: "1.5px solid rgba(255,255,255,0.12)",
            backgroundColor: "transparent",
            color: "rgba(255,255,255,0.45)",
            cursor: "pointer",
            transition: "all 150ms",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 220ms" }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
