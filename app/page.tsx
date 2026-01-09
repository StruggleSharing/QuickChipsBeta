"use client";

import { useEffect, useMemo, useState } from "react";
import { FREE_DELIVERY_MIN_CENTS, NON_MEMBER_DELIVERY_FEE_CENTS } from "@/lib/pricing";

const LS_CONTACT = "qc_membership_contact";
const LS_IS_MEMBER = "qc_membership_is_member";


type Product = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  image_url?: string | null;
};

type CartItem = Product & { qty: number };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Membership (Stripe-backed via /api/membership)
  const [contact, setContact] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [checkingMember, setCheckingMember] = useState(false);

  // Checkout fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [unit, setUnit] = useState("");

  // Delivery timing
  const [deliveryWindow, setDeliveryWindow] = useState<"ASAP_30_60" | "WITHIN_2_HOURS" | "SCHEDULED">("ASAP_30_60");
  const [requestedTimeLocal, setRequestedTimeLocal] = useState("");

  const [placing, setPlacing] = useState(false);

useEffect(() => {
  // Load products
  fetch("/api/products")
    .then((r) => r.json())
    .then((d) => setProducts(d.products ?? []))
    .catch(() => setProducts([]));

  // Restore membership from localStorage
  try {
    const savedContact = localStorage.getItem("qc_membership_contact") ?? "";
    const savedIsMember = localStorage.getItem("qc_membership_is_member");

    if (savedContact) {
      setContact(savedContact);
    }

    if (savedIsMember === "true") {
      setIsMember(true);
    }

    // Silent background re-check
    if (savedContact) {
      checkMembership(savedContact, true);
    }
  } catch {
    // ignore storage errors
  }
}, []);


  async function checkMembership() {
    const c = contact.trim();
    if (!c) {
      setIsMember(false);
      return;
    }

    setCheckingMember(true);
    try {
      const res = await fetch(`/api/membership?contact=${encodeURIComponent(c)}`);
      const data = await res.json().catch(() => ({}));
      setIsMember(!!data?.isMember);
    } catch {
      setIsMember(false);
      alert("Could not check membership right now.");
    } finally {
      setCheckingMember(false);
    }
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.price_cents * i.qty, 0),
    [cart]
  );

  const deliveryFee = useMemo(() => {
    if (!cart.length) return 0;
    if (isMember && subtotal >= FREE_DELIVERY_MIN_CENTS) return 0;
    return NON_MEMBER_DELIVERY_FEE_CENTS;
  }, [isMember, subtotal, cart.length]);

  const total = subtotal + deliveryFee;

  const memberGap = useMemo(() => {
    if (!isMember) return 0;
    return Math.max(0, FREE_DELIVERY_MIN_CENTS - subtotal);
  }, [isMember, subtotal]);

  function addToCart(p: Product) {
    setCart((prev) => {
      const found = prev.find((x) => x.id === p.id);
      if (found) return prev.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...prev, { ...p, qty: 1 }];
    });
  }

  function decFromCart(id: string) {
    setCart((prev) =>
      prev.map((x) => (x.id === id ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0)
    );
  }

  function clearCart() {
    setCart([]);
  }

  async function placeOrder() {
    if (!unit.trim()) return alert("Please enter your Park La Brea unit.");
    if (!cart.length) return alert("Cart is empty.");
    if (deliveryWindow === "SCHEDULED" && !requestedTimeLocal) {
      return alert("Please choose a scheduled time.");
    }

    const requested_time =
      deliveryWindow === "SCHEDULED" && requestedTimeLocal
        ? new Date(requestedTimeLocal).toISOString()
        : null;

    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          phone,
          unit,
          notes: "",
          delivery_window: deliveryWindow,
          requested_time,
          delivery_fee_cents: deliveryFee,
          items: cart.map((i) => ({
            product_id: i.id,
            name: i.name,
            qty: i.qty,
            price_cents: i.price_cents,
            image_url: i.image_url ?? null,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return alert(data?.error ?? "Order failed");
      }

      setCart([]);
      setName("");
      setPhone("");
      setUnit("");
      setDeliveryWindow("ASAP_30_60");
      setRequestedTimeLocal("");

      alert(`Order placed! Status: ${data?.order?.status ?? "NEW"}`);
    } catch {
      alert("Network error placing order.");
    } finally {
      setPlacing(false);
    }
  }

  // Theme tokens
  const accent = "#ff7a18"; // orange
  const bg = "#0b0f14";
  const panel = "#0f1620";
  const panel2 = "#0c121b";
  const border = "rgba(255,255,255,0.08)";
  const text = "rgba(255,255,255,0.92)";
  const muted = "rgba(255,255,255,0.68)";
  const faint = "rgba(255,255,255,0.45)";

  const cardShadow = "0 10px 30px rgba(0,0,0,0.45)";
  const glow = "0 0 0 1px rgba(255,122,24,0.25), 0 10px 35px rgba(255,122,24,0.10)";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: `1px solid ${border}`,
    background: "rgba(255,255,255,0.04)",
    color: text,
    outline: "none",
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "rgba(255,122,24,0.45)" : border}`,
    background: active ? "rgba(255,122,24,0.12)" : "rgba(255,255,255,0.03)",
    color: active ? text : muted,
    cursor: "pointer",
    userSelect: "none",
    boxShadow: active ? "0 0 0 1px rgba(255,122,24,0.20)" : "none",
  });

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: `1px solid rgba(255,122,24,0.45)`,
    background: `linear-gradient(135deg, rgba(255,122,24,0.95), rgba(255,122,24,0.55))`,
    color: "#0b0f14",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: glow,
  };

  const ghostButton: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 14,
    border: `1px solid ${border}`,
    background: "rgba(255,255,255,0.03)",
    color: muted,
    fontWeight: 800,
    cursor: "pointer",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 700px at 20% -10%, rgba(255,122,24,0.18), transparent 55%),
                     radial-gradient(900px 600px at 100% 10%, rgba(255,122,24,0.08), transparent 60%),
                     ${bg}`,
        color: text,
        padding: 18,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "14px 14px",
          borderRadius: 18,
          border: `1px solid ${border}`,
          background: "rgba(15,22,32,0.72)",
          backdropFilter: "blur(10px)",
          boxShadow: cardShadow,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 24, letterSpacing: 0.2 }}>Quick Chips</h1>
              <span style={{ color: muted }}>— Park La Brea</span>
            </div>
            <div style={{ marginTop: 6, color: faint, fontSize: 13 }}>
              Non-perishable snacks delivered. One location only.
            </div>
          </div>

          {/* Membership + Links */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email or phone (membership)"
                style={{
                  padding: 10,
                  borderRadius: 999,
                  border: `1px solid ${border}`,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                  outline: "none",
                  width: 250,
                }}
              />
              <button
                onClick={checkMembership}
                disabled={checkingMember}
                style={{
                  ...pillStyle(isMember),
                  border: `1px solid rgba(255,122,24,0.45)`,
                  background: isMember ? "rgba(255,122,24,0.16)" : "rgba(255,122,24,0.10)",
                  fontWeight: 900,
                  opacity: checkingMember ? 0.7 : 1,
                }}
              >
                {checkingMember ? "Checking…" : isMember ? "✅ Member" : "Check"}
              </button>
            </div>

            <a
              href="/subscribe"
              style={{
                ...pillStyle(false),
                textDecoration: "none",
              }}
            >
              <span style={{ fontWeight: 900, color: text }}>Subscribe</span>
              <span style={{ color: faint, fontSize: 12 }}>$9.99/mo</span>
            </a>

            <a href="/admin" style={{ ...pillStyle(false), textDecoration: "none" }}>
              <span style={{ fontWeight: 900, color: text }}>Admin</span>
            </a>

            <a href="/driver" style={{ ...pillStyle(false), textDecoration: "none" }}>
              <span style={{ fontWeight: 900, color: text }}>Driver</span>
            </a>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div
        style={{
          maxWidth: 1120,
          margin: "14px auto 0",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 14,
        }}
      >
        {/* Menu */}
        <section
          style={{
            borderRadius: 18,
            border: `1px solid ${border}`,
            background: "rgba(15,22,32,0.55)",
            backdropFilter: "blur(10px)",
            boxShadow: cardShadow,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 14, borderBottom: `1px solid ${border}`, background: "rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, letterSpacing: 0.2 }}>Menu</h2>
              <span style={{ color: faint, fontSize: 12 }}>Tap item to add</span>
            </div>
          </div>

          {products.length === 0 ? (
            <div style={{ padding: 14, color: muted }}>
              No products found. Check Supabase → products table.
            </div>
          ) : (
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  style={{
                    border: `1px solid ${border}`,
                    background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`,
                    borderRadius: 18,
                    padding: 12,
                    textAlign: "left",
                    color: text,
                    cursor: "pointer",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 16,
                      overflow: "hidden",
                      border: `1px solid rgba(255,255,255,0.08)`,
                      background: panel2,
                      height: 180,
                      marginBottom: 10,
                      position: "relative",
                    }}
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          filter: "contrast(1.05) saturate(1.05)",
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div style={{ padding: 14, color: faint, fontSize: 12 }}>No image</div>
                    )}

                    <div
                      style={{
                        position: "absolute",
                        left: 10,
                        bottom: 10,
                        padding: "8px 10px",
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.55)",
                        border: `1px solid rgba(255,255,255,0.12)`,
                        display: "inline-flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 900, color: "white" }}>{money(p.price_cents)}</span>
                      <span style={{ color: faint, fontSize: 12 }}>{p.category}</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900, lineHeight: 1.2 }}>{p.name}</div>
                    <span
                      style={{
                        padding: "8px 10px",
                        borderRadius: 14,
                        border: `1px solid rgba(255,122,24,0.35)`,
                        background: "rgba(255,122,24,0.12)",
                        color: text,
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      Add +
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Cart (sticky) */}
        <aside
          style={{
            position: "sticky",
            top: 18,
            alignSelf: "start",
            borderRadius: 18,
            border: `1px solid ${border}`,
            background: "rgba(15,22,32,0.72)",
            backdropFilter: "blur(10px)",
            boxShadow: cardShadow,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 14, borderBottom: `1px solid ${border}`, background: "rgba(0,0,0,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Cart</h2>
              <span style={{ color: faint, fontSize: 12 }}>{cart.length ? `${cart.length} item(s)` : "Empty"}</span>
            </div>
          </div>

          <div style={{ padding: 14 }}>
            {cart.length === 0 ? (
              <div style={{ color: muted, lineHeight: 1.4 }}>
                Add items from the menu.
                <div style={{ marginTop: 10, color: faint, fontSize: 12 }}>Tip: Big images = fast picking.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  {cart.map((i) => (
                    <div
                      key={i.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 10,
                        padding: 12,
                        borderRadius: 16,
                        border: `1px solid ${border}`,
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>{i.name}</div>
                        <div style={{ color: faint, fontSize: 12, marginTop: 4 }}>
                          {money(i.price_cents)} × {i.qty}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => decFromCart(i.id)}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            border: `1px solid ${border}`,
                            background: "rgba(255,255,255,0.03)",
                            color: text,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          −
                        </button>
                        <button
                          onClick={() => addToCart(i)}
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            border: `1px solid rgba(255,122,24,0.35)`,
                            background: "rgba(255,122,24,0.12)",
                            color: text,
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${border}`, background: panel }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: muted }}>
                    <span>Subtotal</span>
                    <span style={{ color: text, fontWeight: 900 }}>{money(subtotal)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: muted, marginTop: 6 }}>
                    <span>Delivery</span>
                    <span style={{ color: text, fontWeight: 900 }}>{money(deliveryFee)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <span style={{ color: muted, fontWeight: 800 }}>Total</span>
                    <span style={{ color: text, fontWeight: 950, fontSize: 18 }}>{money(total)}</span>
                  </div>

                  {isMember && memberGap > 0 ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 14,
                        border: `1px solid rgba(255,122,24,0.25)`,
                        background: "rgba(255,122,24,0.10)",
                        color: text,
                        fontSize: 12,
                        lineHeight: 1.3,
                      }}
                    >
                      Add <b>{money(memberGap)}</b> more for <b>$0 delivery</b>.
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <div style={{ color: faint, fontSize: 12, fontWeight: 900, letterSpacing: 0.4 }}>
                    DELIVERY TIMING
                  </div>

                  <select
                    value={deliveryWindow}
                    onChange={(e) => setDeliveryWindow(e.target.value as any)}
                    style={{ ...inputStyle, appearance: "none" }}
                  >
                    <option value="ASAP_30_60">ASAP (30–60 min)</option>
                    <option value="WITHIN_2_HOURS">Within 2 hours</option>
                    <option value="SCHEDULED">Schedule a time</option>
                  </select>

                  {deliveryWindow === "SCHEDULED" ? (
                    <input
                      type="datetime-local"
                      value={requestedTimeLocal}
                      onChange={(e) => setRequestedTimeLocal(e.target.value)}
                      style={inputStyle}
                    />
                  ) : null}

                  <div style={{ color: faint, fontSize: 12, fontWeight: 900, letterSpacing: 0.4, marginTop: 4 }}>
                    DROP-OFF INFO
                  </div>

                  <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
                  <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" />
                  <input style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Park La Brea Unit *" />

                  <button onClick={placeOrder} disabled={placing} style={{ ...buttonStyle, opacity: placing ? 0.7 : 1 }}>
                    {placing ? "Placing…" : "Place Order"}
                  </button>

                  <button onClick={clearCart} type="button" style={ghostButton}>
                    Clear Cart
                  </button>

                  <div style={{ marginTop: 4, color: faint, fontSize: 12, lineHeight: 1.35 }}>
                    By ordering you confirm delivery is within Park La Brea.
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 980px) {
          main > div:nth-of-type(2) {
            grid-template-columns: 1fr !important;
          }
          aside {
            position: relative !important;
            top: auto !important;
          }
        }
      `}</style>
    </main>
  );
}

