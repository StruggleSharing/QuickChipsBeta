import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseServer";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Helper: upsert subscription row
  async function upsertSub(params: {
    contact: string | null;
    plan: "FREE_DELIVERY" | "SNACK_BOX";
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    status: "inactive" | "active" | "past_due" | "canceled";
    current_period_end?: string | null;
  }) {
    const { contact, plan, stripe_customer_id, stripe_subscription_id, status, current_period_end } = params;

    if (!stripe_subscription_id) return;

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          contact,
          plan,
          stripe_customer_id: stripe_customer_id ?? null,
          stripe_subscription_id,
          status,
          current_period_end: current_period_end ?? null,
        },
        { onConflict: "stripe_subscription_id" }
      );

    if (error) throw error;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // session.subscription can be string | Subscription | null
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        const contact = (session.metadata?.contact ?? null) as string | null;
        const plan = ((session.metadata?.plan ?? "FREE_DELIVERY") as any) as "FREE_DELIVERY" | "SNACK_BOX";

        if (subscriptionId) {
          // fetch subscription for period end + status
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSub({
            contact,
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status:
              sub.status === "active"
                ? "active"
                : sub.status === "past_due"
                ? "past_due"
                : sub.status === "canceled"
                ? "canceled"
                : "inactive",
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const contact = (sub.metadata?.contact ?? null) as string | null;
        const plan = ((sub.metadata?.plan ?? "FREE_DELIVERY") as any) as "FREE_DELIVERY" | "SNACK_BOX";

        await upsertSub({
          contact,
          plan,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          stripe_subscription_id: sub.id,
          status:
            sub.status === "active"
              ? "active"
              : sub.status === "past_due"
              ? "past_due"
              : sub.status === "canceled"
              ? "canceled"
              : "inactive",
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        });
        break;
      }

      default:
        break;
    }
  } catch (e: any) {
    return new Response(`Webhook handler failed: ${e.message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

