"use client";

import { useMemo, useState } from "react";

type Order = {
  id: string;
  unit: string;
  customer_name: string | null;
  phone: string | null;
  items: any[];
  status: "NEW" | "CONFIRMED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELED";
  delivery_window: string | null;
  requested_time: string | null;
  created_at: string;
  total_cents: number;
};

export default function DriverPage() {
  const [adminKey, setAdminKey] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const visible = useMemo(
    () => orders.filter((o) => o.status === "CONFIRMED" || o.status === "OUT_FOR_DELIVERY"),
    [orders]
  );

  async function loadOrders() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? "Failed to load orders");
        setOrders([]);
      } else {
        setOrders(data.orders ?? []);
      }
    } catch {
      setErr("Network error");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: Order["status"]) {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.error ?? "Failed to update");
      setOrders((prev) => prev.map((o) => (o.id === id ? data.order : o)));
    } catch {
      alert("Network error updating status");
    }
  }

  function timingLabel(o: Order) {
    if (o.delivery_window === "ASAP_30_60") return "ASAP (30–60)";
    if (o.delivery_window === "WITHIN_2_HOURS") return "Within 2 hours";
    if (o.delivery_window === "SCHEDULED") {
      return o.requested_time ? `Scheduled: ${new Date(o.requested_time).toLocaleString()}` : "Scheduled";
    }
    return "—";
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 20, fontFamily: "system-ui" }}>
      <h1>Driver View</h1>
      <p style={{ opacity: 0.75 }}>Shows CONFIRMED + OUT_FOR_DELIVERY only.</p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <input
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin key"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", width: 340 }}
        />
        <button
          onClick={loadOrders}
          disabled={!adminKey || loading}
          style={{ padding: "12px 16px", borderRadius: 12, fontWeight: 700 }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && <p style={{ color: "crimson" }}>{err}</p>}

      {visible.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No active deliveries.</p>
      ) : (
        visible.map((o) => (
          <section
            key={o.id}
            style={{
              border: "2px solid #111",
              borderRadius: 18,
              padding: 16,
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>Unit {o.unit}</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>{timingLabel(o)}</div>
                <div style={{ opacity: 0.7, marginTop: 4 }}>
                  {new Date(o.created_at).toLocaleString()}
                </div>
                {(o.customer_name || o.phone) && (
                  <div style={{ marginTop: 6, opacity: 0.85 }}>
                    {o.customer_name ? `Name: ${o.customer_name}` : ""}
                    {o.customer_name && o.phone ? " • " : ""}
                    {o.phone ? `Phone: ${o.phone}` : ""}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 18, fontWeight: 900 }}>
                ${(o.total_cents / 100).toFixed(2)}
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 16 }}>
              {Array.isArray(o.items) &&
                o.items.map((it: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700 }}>{it.name}</span>
                    <span>× {it.qty}</span>
                  </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {o.status === "CONFIRMED" ? (
                <button
                  onClick={() => setStatus(o.id, "OUT_FOR_DELIVERY")}
                  style={{ padding: "14px 16px", borderRadius: 14, fontWeight: 900 }}
                >
                  Start Delivery
                </button>
              ) : null}

              {o.status === "OUT_FOR_DELIVERY" ? (
                <button
                  onClick={() => setStatus(o.id, "DELIVERED")}
                  style={{ padding: "14px 16px", borderRadius: 14, fontWeight: 900 }}
                >
                  Mark Delivered
                </button>
              ) : null}

              <button
                onClick={() => setStatus(o.id, "CANCELED")}
                style={{ padding: "14px 16px", borderRadius: 14 }}
              >
                Cancel
              </button>
            </div>
          </section>
        ))
      )}
    </main>
  );
}

