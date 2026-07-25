import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { item_ids, occasion, season, style_rationale, user_rating } = await request.json();

    const sb = getSupabase();

    // Dedup: if same item combo already exists in history, return the existing entry
    const sortedIds = [...item_ids].sort();
    const { data: existing } = await sb
      .from("outfit_history")
      .select("*")
      .eq("occasion", occasion)
      .eq("season", season);
    const duplicate = existing?.find(
      (e: { item_ids: string[] }) => [...e.item_ids].sort().join(",") === sortedIds.join(",")
    );
    if (duplicate) {
      return Response.json({ entry: duplicate });
    }

    const { data, error } = await sb
      .from("outfit_history")
      .insert({ item_ids, occasion, season, style_rationale, user_rating: user_rating ?? null })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ entry: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
