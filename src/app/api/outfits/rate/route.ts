import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    const { id, rating } = await request.json();
    if (!id || rating == null) return Response.json({ error: "id and rating required" }, { status: 400 });
    if (rating < 0 || rating > 5) return Response.json({ error: "rating must be 0–5" }, { status: 400 });

    const sb = getSupabase();

    const { data, error } = await sb
      .from("outfit_history")
      .update({ user_rating: rating === 0 ? null : rating })
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    // Check if style profile needs updating (every 10 meaningful ratings)
    const [{ count: ratedCount }, { data: profile }] = await Promise.all([
      sb.from("outfit_history").select("id", { count: "exact", head: true }).not("user_rating", "is", null).neq("user_rating", 0),
      sb.from("style_profile").select("rated_count").eq("id", 1).single(),
    ]);

    const should_update_profile = rating !== 0 && (ratedCount ?? 0) >= ((profile?.rated_count ?? 0) + 10);

    return Response.json({ entry: data, should_update_profile });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
