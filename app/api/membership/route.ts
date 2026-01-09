import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const contact = (url.searchParams.get("contact") ?? "").trim();

  if (!contact) {
    return Response.json({ isMember: false, status: "inactive" });
  }

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end, plan")
    .eq("plan", "FREE_DELIVERY")
    .eq("contact", contact)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const isMember = data?.status === "active";
  return Response.json({
    isMember,
    status: data?.status ?? "inactive",
    current_period_end: data?.current_period_end ?? null,
  });
}

