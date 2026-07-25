"use client";

import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    if (res.ok) {
      // Redirect to home (or the page they came from)
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("from") || "/";
    } else {
      setError("Incorrect passcode. Try again.");
      setPasscode("");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh",
      backgroundColor: "#0C0C0C",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: "3rem", textAlign: "center" }}>
        <p style={{
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: "2.75rem",
          fontWeight: 700,
          fontStyle: "italic",
          color: "#FFFFFF",
          letterSpacing: "-0.03em",
          lineHeight: 1,
          marginBottom: "6px",
        }}>
          Dripson
        </p>
        <div style={{ width: "32px", height: "2px", backgroundColor: "#C5A028", margin: "0 auto" }} />
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "320px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <input
          type="password"
          placeholder="Enter passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoFocus
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: "1rem",
            fontFamily: "var(--font-inter), sans-serif",
            backgroundColor: "rgba(255,255,255,0.06)",
            border: `1.5px solid ${error ? "#FECACA" : "rgba(255,255,255,0.12)"}`,
            borderRadius: "10px",
            color: "#FFFFFF",
            outline: "none",
            letterSpacing: "0.1em",
            textAlign: "center",
            boxSizing: "border-box",
            transition: "border-color 150ms",
          }}
          onFocus={(e) => { if (!error) (e.target as HTMLInputElement).style.borderColor = "#C5A028"; }}
          onBlur={(e) => { if (!error) (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
        />

        {error && (
          <p style={{ fontSize: "0.8rem", color: "#FECACA", textAlign: "center", margin: 0 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!passcode || loading}
          style={{
            width: "100%",
            minHeight: "50px",
            backgroundColor: passcode && !loading ? "#C5A028" : "rgba(197,160,40,0.3)",
            color: passcode && !loading ? "#0C0C0C" : "rgba(255,255,255,0.3)",
            border: "none",
            borderRadius: "10px",
            fontSize: "0.875rem",
            fontWeight: 700,
            fontFamily: "var(--font-inter), sans-serif",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: passcode && !loading ? "pointer" : "not-allowed",
            transition: "all 150ms",
          }}
        >
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
