import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import type { ClothingItem } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  try {
    const { data } = await getSupabase().from("style_profile").select("*").eq("id", 1).single();
    return Response.json({ profile: data ?? null });
  } catch {
    return Response.json({ profile: null });
  }
}

export async function POST() {
  try {
    const sb = getSupabase();

    // Fetch rated outfits (cap at 60 for prompt size)
    const { data: history } = await sb
      .from("outfit_history")
      .select("*")
      .not("user_rating", "is", null)
      .neq("user_rating", 0)
      .order("worn_date", { ascending: false })
      .limit(60);

    if (!history?.length || history.length < 3) {
      return Response.json({ error: "Need at least 3 rated outfits to build a profile" }, { status: 422 });
    }

    const [{ data: items }, { count: ratedCount }] = await Promise.all([
      sb.from("clothing_items").select("*").eq("is_active", true),
      sb.from("outfit_history").select("id", { count: "exact", head: true }).not("user_rating", "is", null).neq("user_rating", 0),
    ]);

    const itemMap = new Map((items || []).map((i: ClothingItem) => [i.id, i]));

    const formatOutfit = (h: { style_rationale: string; item_ids: string[] }) => {
      const name = (h.style_rationale || "").split("||")[0] || "Unnamed";
      const outfitItems = h.item_ids
        .map((id: string) => itemMap.get(id))
        .filter(Boolean)
        .map((it) => {
          const item = it as ClothingItem;
          return `${item.subcategory || item.category} (${item.color}, ${item.style})`;
        });
      return `${name}: ${outfitItems.join(", ")}`;
    };

    const liked    = history.filter(h => (h.user_rating ?? 0) >= 4).map(formatOutfit);
    const disliked = history.filter(h => (h.user_rating ?? 0) <= 2).map(formatOutfit);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You are a personal style analyst for a NYC men's fashion app. Analyze this person's outfit ratings to build their style profile.

LIKED OUTFITS (${liked.length}):
${liked.join("\n") || "none yet"}

DISLIKED OUTFITS (${disliked.length}):
${disliked.join("\n") || "none yet"}

Identify: dominant colors in liked outfits, style patterns they gravitate toward, what they consistently avoid.

Return ONLY valid JSON:
{
  "key_insights": "1-2 plain-English sentences describing their personal style, e.g. 'Smart-casual with neutral palettes and fitted silhouettes.'",
  "top_colors": ["navy", "white", "olive"],
  "disliked_colors": ["brown"],
  "preferred_styles": ["slim fit", "minimalist", "smart casual"]
}`,
      }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const match   = rawText.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: "Failed to parse profile" }, { status: 422 });

    const parsed = JSON.parse(match[0]);

    const { data: saved, error } = await sb
      .from("style_profile")
      .upsert({ id: 1, ...parsed, rated_count: ratedCount ?? 0, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select()
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ profile: saved });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
