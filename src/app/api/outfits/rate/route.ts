import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    const { id, rating } = await request.json();
    if (!id || rating == null) return Response.json({ error: "id and rating required" }, { status: 400 });
    if (rating < 0 || rating > 5) return Response.json({ error: "rating must be 0–5" }, { status: 400 });

    const { data, error } = await getSupabase()
      .from("outfit_history")
      .update({ user_rating: rating === 0 ? null : rating })
      .eq("id", id)
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ entry: data });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
