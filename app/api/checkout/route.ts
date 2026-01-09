import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const contact = (body?.contact ?? "").toString().trim();

    if (!contact) {
      return Response.json({ error: "Contact is required (email or phone)." }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Missing STRIPE_SECRET_KEY in .env.local" }, { status: 500 });
    }

    const priceId = process.env.STRIPE_PRICE_FREE_DELIVERY;
    if (!priceId) {
      return Response.json({ error: "Missing STRIPE_PRICE_FREE_DELIVERY in .env.local" }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/subscribe?success=1`,
      cancel_url: `${baseUrl}/subscribe?canceled=1`,
      customer_creation: "always",
      allow_promotion_codes: true,
      metadata: { contact, plan: "FREE_DELIVERY" },
      subscription_data: { metadata: { contact, plan: "FREE_DELIVERY" } },
    });

    return Response.json({ url: session.url });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? "Checkout failed", details: e?.raw?.message ?? null, type: e?.type ?? null },
      { status: 500 }
    );
  }
}

