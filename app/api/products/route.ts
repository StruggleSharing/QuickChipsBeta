import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ products: data ?? [] });
}

