"use client";

import { useEffect, useState, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ClothingItem, Category } from "@/lib/types";

const CATEGORY_LABELS: Record<Category, string> = {
  shirt: "Shirts", pants: "Pants", shoes: "Shoes",
  accessory: "Accessories", outerwear: "Outerwear", other: "Other",
};
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export default function WardrobePage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [selected, setSelected] = useState<ClothingItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState<Category>("shirt");
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ name: string; status: "ok" | "error" }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadItems() {
    const { data } = await getSupabase()
      .from("clothing_items")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  async function deactivate(id: string) {
    await getSupabase().from("clothing_items").update({ is_active: false }).eq("id", id);
    setItems((p) => p.filter((i) => i.id !== id));
    setSelected(null);
  }

  async function updateCategory(id: string, category: Category) {
    setSaving(true);
    await getSupabase().from("clothing_items").update({ category }).eq("id", id);
    setItems((p) => p.map((i) => i.id === id ? { ...i, category } : i));
    setSelected((s) => s ? { ...s, category } : null);
    setEditingCategory(null);
    setSaving(false);
  }

  // Upload handlers
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))]);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!).filter((f) => f.type.startsWith("image/"))]);
  }

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    setUploadResults([]);
    const results: typeof uploadResults = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      form.append("category", uploadCategory);
      try {
        const res = await fetch("/api/catalog", { method: "POST", body: form });
        const data = await res.json();
        results.push({ name: file.name, status: res.ok ? "ok" : "error" });
        void data;
      } catch {
        results.push({ name: file.name, status: "error" });
      }
    }
    setUploadResults(results);
    setFiles([]);
    setUploading(false);
    // Refresh wardrobe grid with newly added items
    await loadItems();
  }

  function closeUpload() {
    setShowUpload(false);
    setFiles([]);
    setUploadResults([]);
    setIsDragging(false);
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);
  const counts = ALL_CATEGORIES.reduce<Record<string, number>>((a, c) => ({ ...a, [c]: items.filter((i) => i.category === c).length }), {});

  return (
    <div className="page-content">
      <div className="anim-fade-up" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <p className="page-label">Catalog</p>
          <h1 className="page-title">Wardrobe</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {items.length > 0 && (
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "2.25rem", fontWeight: 700, lineHeight: 1, color: "var(--c-fg)", letterSpacing: "-0.04em" }}>{items.length}</p>
              <p style={{ fontSize: "0.6rem", color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>items</p>
            </div>
          )}
          <button
            onClick={() => { setShowUpload(true); setUploadResults([]); }}
            className="btn-primary"
            style={{ minHeight: "40px", padding: "0 18px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Items
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--c-fg-muted)", fontSize: "0.875rem", paddingTop: "2rem" }}>Loading...</p>
      ) : items.length === 0 ? (
        <div className="anim-scale-in" style={{ textAlign: "center", padding: "6rem 0" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", marginBottom: "6px", fontWeight: 600 }}>Empty wardrobe.</p>
          <p style={{ color: "var(--c-fg-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Start by uploading your clothing photos.</p>
          <button onClick={() => setShowUpload(true)} className="btn-primary" style={{ textDecoration: "none" }}>Upload Items</button>
        </div>
      ) : (
        <>
          {/* Filter chips */}
          <div className="anim-fade-up d-1" style={{ display: "flex", gap: "6px", marginBottom: "1.75rem", overflowX: "auto", paddingBottom: "4px" }}>
            {[{ value: "all" as const, label: `All (${items.length})` },
              ...ALL_CATEGORIES.filter((c) => counts[c] > 0).map((c) => ({ value: c, label: `${CATEGORY_LABELS[c]} (${counts[c]})` }))
            ].map(({ value, label }) => (
              <button key={value} onClick={() => setFilter(value)} className={`chip${filter === value ? " active" : ""}`} style={{ flexShrink: 0 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 anim-fade-up d-2">
            {filtered.map((item) => (
              <div key={item.id} className="wardrobe-item card" onClick={() => setSelected(item)} style={{
                overflow: "hidden", cursor: "pointer", padding: 0, borderRadius: "var(--r-md)",
              }}>
                <div style={{ aspectRatio: "3/4", overflow: "hidden", backgroundColor: "var(--c-surface-2)" }}>
                  <img src={item.image_url} alt={item.subcategory || item.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div className="reveal">
                    <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>View Details</span>
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.65rem", textTransform: "capitalize" }}>{item.color}</span>
                  </div>
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--c-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "capitalize" }}>
                    {item.subcategory || item.category}
                  </p>
                  <p style={{ fontSize: "0.68rem", color: "var(--c-fg-muted)", textTransform: "capitalize", marginTop: "1px" }}>{item.color}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upload panel */}
      {showUpload && (
        <div onClick={closeUpload} style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.70)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          zIndex: 100,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: "var(--c-surface)",
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
            width: "100%", maxWidth: "520px",
            padding: "1.75rem 1.75rem calc(1.75rem + env(safe-area-inset-bottom, 0px))",
            boxShadow: "var(--sh-xl)", maxHeight: "90dvh", overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div>
                <p style={{ fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--c-fg-muted)", fontWeight: 700, marginBottom: "2px" }}>Wardrobe</p>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Add Items</h2>
              </div>
              <button onClick={closeUpload} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-fg-muted)", fontSize: "1.4rem", lineHeight: 1, padding: "4px" }}>×</button>
            </div>

            {/* Category */}
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--c-fg-muted)", fontWeight: 700, marginBottom: "10px" }}>Category</p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {ALL_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setUploadCategory(c)} className={`chip${uploadCategory === c ? " active" : ""}`}>
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              style={{
                border: `2px dashed ${isDragging ? "var(--c-fg)" : "var(--c-border-2)"}`,
                borderRadius: "var(--r-lg)", padding: "2.5rem 1.5rem",
                textAlign: "center", cursor: "pointer",
                backgroundColor: isDragging ? "var(--c-surface-2)" : "transparent",
                transition: "all var(--t-base) var(--ease)",
                marginBottom: "1rem",
              }}
            >
              <div style={{ width: "44px", height: "44px", margin: "0 auto 1rem", backgroundColor: "var(--c-surface-2)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--c-border)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-fg-soft)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 600, marginBottom: "4px" }}>Drop photos here</p>
              <p style={{ fontSize: "0.8rem", color: "var(--c-fg-muted)" }}>or tap to browse · JPG, PNG, HEIC</p>
              <input ref={inputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
            </div>

            {/* Preview grid */}
            {files.length > 0 && (
              <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
                <p style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "10px", color: "var(--c-fg-soft)" }}>{files.length} ready to analyze</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "var(--r-sm)", border: "1px solid var(--c-border)" }} />
                      <button
                        onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((_, j) => j !== i)); }}
                        style={{ position: "absolute", top: "4px", right: "4px", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.75)", color: "#fff", border: "none", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload results */}
            {uploadResults.length > 0 && (
              <div style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "5px" }}>
                {uploadResults.map((r, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px",
                    borderRadius: "var(--r-sm)", fontSize: "0.8rem",
                    backgroundColor: r.status === "ok" ? "#F0FDF4" : "#FEF2F2",
                    color: r.status === "ok" ? "#166534" : "#991B1B",
                    border: `1px solid ${r.status === "ok" ? "#BBF7D0" : "#FECACA"}`,
                  }}>
                    <span style={{ fontWeight: 700 }}>{r.status === "ok" ? "✓" : "✗"}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div style={{ display: "flex", gap: "8px" }}>
              {uploadResults.length > 0 ? (
                <button onClick={closeUpload} className="btn-primary" style={{ flex: 1, minHeight: "48px", fontSize: "0.8125rem" }}>
                  Done
                </button>
              ) : (
                <>
                  <button onClick={closeUpload} className="btn-ghost" style={{ minHeight: "48px", padding: "0 18px", fontSize: "0.8125rem" }}>Cancel</button>
                  <button
                    onClick={handleUpload}
                    disabled={!files.length || uploading}
                    className="btn-primary"
                    style={{ flex: 1, minHeight: "48px", fontSize: "0.8125rem" }}
                  >
                    {uploading ? "Analyzing with Claude Vision..." : files.length > 0 ? `Analyze ${files.length} Item${files.length > 1 ? "s" : ""}` : "Select Photos"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.70)",
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          zIndex: 100,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: "var(--c-surface)",
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
            width: "100%", maxWidth: "460px",
            overflow: "hidden", boxShadow: "var(--sh-xl)",
          }}>
            <div style={{ aspectRatio: "4/3", overflow: "hidden", backgroundColor: "var(--c-surface-2)", maxHeight: "300px" }}>
              <img src={selected.image_url} alt={selected.subcategory || selected.category} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ padding: "1.5rem 1.75rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, textTransform: "capitalize", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: "4px" }}>
                    {selected.subcategory || selected.category}
                  </h2>
                  <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-muted)", textTransform: "capitalize" }}>
                    {selected.color} · {selected.style}
                  </p>
                </div>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--c-gold)", backgroundColor: "var(--c-gold-bg)", border: "1px solid #E8D9A0", padding: "5px 10px", borderRadius: "var(--r-sm)" }}>
                  {selected.formality_level}/5
                </span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--c-fg-soft)", lineHeight: 1.7, marginBottom: "1rem" }}>
                {selected.ai_description}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "1.5rem" }}>
                {[...selected.seasons, ...selected.occasions].map((tag) => (
                  <span key={tag} style={{ fontSize: "0.68rem", padding: "4px 10px", borderRadius: "100px", backgroundColor: "var(--c-surface-2)", color: "var(--c-fg-soft)", fontWeight: 500, textTransform: "capitalize", border: "1px solid var(--c-border)" }}>
                    {tag.replace("_", " ")}
                  </span>
                ))}
              </div>
              {/* Category editor */}
              <div style={{ marginBottom: "1.25rem" }}>
                <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--c-fg-muted)", marginBottom: "8px" }}>Category</p>
                {editingCategory !== null ? (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {ALL_CATEGORIES.map((c) => (
                      <button key={c} onClick={() => setEditingCategory(c)} className={`chip${editingCategory === c ? " active" : ""}`} style={{ fontSize: "0.75rem", minHeight: "34px" }}>
                        {CATEGORY_LABELS[c]}
                      </button>
                    ))}
                    <button onClick={() => updateCategory(selected.id, editingCategory)} disabled={saving} className="btn-primary" style={{ minHeight: "34px", fontSize: "0.75rem", padding: "0 14px" }}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingCategory(null)} className="btn-ghost" style={{ minHeight: "34px", fontSize: "0.75rem", padding: "0 12px" }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--c-fg-soft)", textTransform: "capitalize", fontWeight: 500 }}>{CATEGORY_LABELS[selected.category]}</span>
                    <button onClick={() => setEditingCategory(selected.category)} style={{ fontSize: "0.72rem", color: "var(--c-gold)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, fontWeight: 600 }}>Change</button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setSelected(null)} className="btn-ghost" style={{ flex: 1 }}>Close</button>
                <button onClick={() => deactivate(selected.id)} style={{ minHeight: "40px", padding: "0 20px", border: "1.5px solid #FECACA", borderRadius: "var(--r-sm)", backgroundColor: "#FEF2F2", color: "#991B1B", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
