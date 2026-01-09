"use client";

import { useState } from "react";

export default function SubscribePage() {
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);

async function startCheckout() {
  if (!contact.trim()) return alert("Enter email or phone.");

  setLoading(true);
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact }),
    });

    const text = await res.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      return alert(data?.error ?? text ?? "Checkout failed (no response body)");
    }

    if (!data?.url) {
      return alert("Checkout failed: missing session url");
    }

    window.location.href = data.url;
  } finally {
    setLoading(false);
  }
}

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <h1>Free Delivery Membership</h1>
      <p>$9.99/month — free delivery on orders $10+</p>

      <input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="Email or phone"
        style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
      />

      <button
        onClick={startCheckout}
        disabled={loading}
        style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, fontWeight: 800 }}
      >
        {loading ? "Starting…" : "Subscribe"}
      </button>
    </main>
  );
}


