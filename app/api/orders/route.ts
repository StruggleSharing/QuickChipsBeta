import { supabaseAdmin } from "@/lib/supabaseServer";

type OrderItem = {
  product_id: string;
  name: string;
  qty: number;
  price_cents: number;
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const customer_name = (body?.customer_name ?? "").toString();
  const phone = (body?.phone ?? "").toString();
  const unit = (body?.unit ?? "").toString().trim();
  const notes = (body?.notes ?? "").toString();

  const items = (body?.items ?? []) as OrderItem[];
  const delivery_fee_cents = Number(body?.delivery_fee_cents ?? 0);

  if (!unit) {
    return Response.json({ error: "Unit is required." }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "Items are required." }, { status: 400 });
  }

  // Recompute subtotal from items (never trust the client)
  let subtotal_cents = 0;
  for (const it of items) {
    const qty = Number(it.qty ?? 0);
    const price = Number(it.price_cents ?? 0);
    if (!it.product_id || !it.name || qty <= 0 || price < 0) {
      return Response.json({ error: "Invalid item payload." }, { status: 400 });
    }
    subtotal_cents += qty * price;
  }

  const safe_delivery_fee_cents = Number.isFinite(delivery_fee_cents) && delivery_fee_cents >= 0
    ? delivery_fee_cents
    : 0;

  const total_cents = subtotal_cents + safe_delivery_fee_cents;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_name: customer_name || null,
      phone: phone || null,
      unit,
      notes: notes || null,
      items,
      subtotal_cents,
      delivery_fee_cents: safe_delivery_fee_cents,
      total_cents,
      status: "NEW",
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ order: data }, { status: 201 });
}

