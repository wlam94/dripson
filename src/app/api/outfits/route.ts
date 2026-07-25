import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import type { ClothingItem } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { occasion, season, weather, savedCombos } = await request.json();

    if (!occasion || !season) {
      return Response.json({ error: "occasion and season are required" }, { status: 400 });
    }

    const sb = getSupabase();

    // Fetch active wardrobe items for this occasion + season
    const { data: items, error } = await sb
      .from("clothing_items")
      .select("*")
      .eq("is_active", true)
      .contains("occasions", [occasion])
      .contains("seasons", [season]);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!items || items.length < 2) {
      return Response.json({
        error: "Not enough wardrobe items for this occasion/season. Upload more clothes first.",
      }, { status: 422 });
    }

    // Get outfit history — recent combos to avoid + top-rated for style context
    const { data: history } = await sb
      .from("outfit_history")
      .select("item_ids, user_rating, style_rationale")
      .eq("occasion", occasion)
      .eq("season", season)
      .order("created_at", { ascending: false })
      .limit(500);

    const wornCombos = (history || []).map((h) => h.item_ids.sort().join(","));
    const recentCombos = [...wornCombos, ...((savedCombos as string[][]) || []).map((ids: string[]) => [...ids].sort().join(","))];
    const topRated = (history || [])
      .filter((h) => h.user_rating >= 4)
      .slice(0, 3)
      .map((h) => `Rating ${h.user_rating}/5: "${h.style_rationale}"`);
    const lowestRated = (history || [])
      .filter((h) => h.user_rating <= 2)
      .slice(0, 2)
      .map((h) => `Rating ${h.user_rating}/5: "${h.style_rationale}"`);

    const catalog = items.map((item: ClothingItem) => ({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      colors: item.colors,
      style: item.style,
      formality_level: item.formality_level,
      ai_description: item.ai_description,
    }));

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a precise men's stylist. Build 3 outfits from the wardrobe below. No filler — just make the outfits work.

OCCASION: ${occasion} | SEASON: ${season}${weather ? ` | CONDITIONS: ${weather}` : ""}

${topRated.length ? `\nUSER LIKES (mirror these styles): ${topRated.join(" | ")}` : ""}
${lowestRated.length ? `\nUSER DISLIKES (avoid these): ${lowestRated.join(" | ")}` : ""}

WARDROBE:
${JSON.stringify(catalog, null, 2)}

COMBOS TO SKIP (worn or saved already):
${recentCombos.length ? recentCombos.join("\n") : "none"}

HARD RULES — violating any = invalid outfit:
1. Must include: 1 top (shirt/outerwear), 1 bottom (pants), 1 shoes. Accessories optional.
2. Formality gap max 2 points (e.g. formality 3 top + formality 1 shoes = invalid)
3. No more than 3 colors per outfit. Neutrals (white/black/grey/khaki/navy/cream) don't count toward the limit.
4. Season check: no linen/shorts in winter, no heavy knits/outerwear in summer
5. Only include outfit if it scores 8+/10

COLOR RULES:
- Monochromatic (same color family, different shades) always works
- Neutrals + 1 accent color always works
- Navy + khaki, olive + cream, grey + white, burgundy + navy = proven combos
- Avoid: brown + black, navy + black, more than 1 pattern

SILHOUETTE RULES:
- Slim/tapered bottom → can wear relaxed or fitted top
- Wide/relaxed bottom → fitted top only to avoid looking shapeless
- Layering (outerwear over shirt): outerwear should be 1 formality point above or equal to shirt

NYC ${season} CONTEXT:
- spring/fall 50-65°F: light layers, no heavy coats, chinos over shorts
- summer 75-90°F humid: breathe-first (linen, cotton), minimal layers
- winter 20-40°F: outerwear required, no shorts, no linen
- Current NYC style: clean and put-together over trendy. Fit matters more than brand.

OUTPUT: Write rationale like a friend (1-2 sentences, plain english, no jargon). Style tip = one specific physical action to wear it better. Name = short creative outfit name (2-4 words, e.g. "The Uptown Edit", "City Casual", "Weekend Sharp" — no quotes in output).

Return ONLY valid JSON:
{
  "outfits": [
    {
      "name": "The Uptown Edit",
      "item_ids": ["uuid1", "uuid2", "uuid3"],
      "rating": 9,
      "rationale": "...",
      "style_tip": "..."
    }
  ]
}`,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Failed to generate outfit recommendations" }, { status: 422 });
    }

    const { outfits } = JSON.parse(jsonMatch[0]);

    // Hydrate with full item data
    const itemMap = new Map(items.map((i: ClothingItem) => [i.id, i]));
    const hydrated = outfits.map((outfit: { name: string; item_ids: string[]; rating: number; rationale: string; style_tip: string }) => ({
      ...outfit,
      items: outfit.item_ids.map((id: string) => itemMap.get(id)).filter(Boolean),
    }));

    return Response.json({ outfits: hydrated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
