// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Stripe requires the raw body to verify signatures.
// Next.js App Router gives us req.text() which preserves raw payload.
export async function POST(req: Request) {
  const sig = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }
  if (!sig) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return Response.json(
      { error: "Webhook signature verification failed", details: err?.message ?? String(err) },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      /**
       * Checkout completion: best place to "create/activate" a subscription record
       * because we have session.metadata.contact from your /api/checkout creation.
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;

        const contact = (session.metadata?.contact ?? "").trim();
        const plan = (session.metadata?.plan ?? "FREE_DELIVERY").trim();

        if (!subscriptionId || !customerId || !contact) break;

        // Retrieve subscription to get accurate status + current_period_end
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await upsertSubscription({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: sub.status,
          plan: (sub.metadata?.plan ?? plan) || "FREE_DELIVERY",
          contact,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });

        break;
      }

      /**
       * Subscription updates: keeps status/period_end synced over time.
       */
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const contact = (sub.metadata?.contact ?? "").trim();
        const plan = (sub.metadata?.plan ?? "FREE_DELIVERY").trim();

        if (!sub.id || !customerId || !contact) break;

        await upsertSubscription({
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          status: sub.status,
          plan: plan || "FREE_DELIVERY",
          contact,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });

        break;
      }

      /**
       * Subscription deleted: mark canceled.
       */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const contact = (sub.metadata?.contact ?? "").trim();
        const plan = (sub.metadata?.plan ?? "FREE_DELIVERY").trim();

        if (!sub.id || !customerId || !contact) break;

        await upsertSubscription({
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          status: "canceled",
          plan: plan || "FREE_DELIVERY",
          contact,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });

        break;
      }

      default:
        // Ignore other events
        break;
    }

    return Response.json({ received: true });
  } catch (err: any) {
    return Response.json(
      { error: "Webhook handler failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

async function upsertSubscription(input: {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  plan: string;
  contact: string;
  current_period_end: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        stripe_customer_id: input.stripe_customer_id,
        stripe_subscription_id: input.stripe_subscription_id,
        status: input.status,
        plan: input.plan,
        contact: input.contact,
        current_period_end: input.current_period_end,
      },
      { onConflict: "stripe_subscription_id" }
    );

  if (error) throw new Error(error.message);
}

