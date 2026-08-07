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

    // Fetch style profile for personalization
    const { data: styleProfile } = await sb.from("style_profile").select("*").eq("id", 1).single();

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

    // Build a base-combo tracker (shirt/outerwear + pants) to detect repeated bases
    const itemCatMap = new Map(items.map((i: ClothingItem) => [i.id, i.category]));
    const TOP_CAT_SET = new Set(["shirt", "outerwear"]);
    const BOT_CAT_SET = new Set(["pants"]);

    function getBaseKey(itemIds: string[]): string {
      const tops = itemIds.filter(id => TOP_CAT_SET.has(itemCatMap.get(id) ?? "")).sort();
      const bots = itemIds.filter(id => BOT_CAT_SET.has(itemCatMap.get(id) ?? "")).sort();
      return [...tops, ...bots].join(",");
    }

    // Recent base combos (last 30 outfits) — Claude should strongly prefer fresh bases
    const recentBases = [...new Set(
      (history || []).slice(0, 30).map(h => getBaseKey(h.item_ids)).filter(Boolean)
    )];

    const catalog = items.map((item: ClothingItem) => ({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      colors: item.colors,
      style: item.style,
    }));

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a precise men's stylist. Build 2-3 outfit cores from the wardrobe below. Each core is a top + bottom (+ optional outerwear) that can be finished two different ways with different shoes/accessories for different vibes.

OCCASION: ${occasion} | SEASON: ${season}${weather ? ` | CONDITIONS: ${weather}` : ""}
${styleProfile?.key_insights ? `
PERSONAL STYLE PROFILE (learned from ${styleProfile.rated_count} rated outfits):
${styleProfile.key_insights}
- Colors they love: ${(styleProfile.top_colors as string[] || []).join(", ")}
- Colors to avoid: ${(styleProfile.disliked_colors as string[] || []).join(", ")}
- Their style: ${(styleProfile.preferred_styles as string[] || []).join(", ")}
Mirror this profile — prioritize their palette and style patterns above all else (within the occasion/season rules).
` : ""}
${topRated.length ? `\nUSER LIKES (mirror these styles): ${topRated.join(" | ")}` : ""}
${lowestRated.length ? `\nUSER DISLIKES (avoid these): ${lowestRated.join(" | ")}` : ""}

WARDROBE:
${JSON.stringify(catalog, null, 2)}

COMBOS TO SKIP (exact full outfits already worn — never repeat these):
${recentCombos.length ? recentCombos.join("\n") : "none"}

RECENTLY USED BASES — shirt+pants pairs from the last 30 outfits (IDs joined). STRONGLY prefer bases NOT on this list. Only reuse a base if the wardrobe has no other viable option:
${recentBases.length ? recentBases.join("\n") : "none"}

HARD RULES — violating any = invalid outfit:
1. core_item_ids: top (shirt/outerwear) + bottom (pants). No shoes, no accessories in core.
2. Each variant must include exactly 1 shoes item. Accessories optional.
3. No more than 3 colors total (core + variant). Neutrals (white/black/grey/khaki/navy/cream) don't count.
5. Season check: no linen/shorts in winter, no heavy knits/outerwear in summer.
6. Only include outfit if core scores 8+/10.
7. The 2 variants per core must feel genuinely different (e.g. "Office" vs "Night Out", "Smart" vs "Relaxed").
8. CRITICAL — NO DUPLICATE CORES: If two outfits would use the same top AND same bottom, they MUST be one outfit with two variants. Never output two separate outfit objects sharing the same top or same bottom. Each outfit object must have a unique top+bottom combination.
9. NO REPEATED SHIRT+PANTS PAIR: Every outfit in your response must use a different shirt+pants combination. The same shirt may appear with a different pair of pants, and the same pants may appear with a different shirt — but the exact same shirt ID paired with the exact same pants ID must not appear in more than one outfit object.
10. FRESH BASES FIRST: Prioritize top+bottom pairs NOT in the RECENTLY USED BASES list above. Picking a fresh base scores higher than any other consideration after rules 1-9. If you must reuse a base, pick the one used least recently.

COLOR RULES:
- Monochromatic (same color family, different shades) always works
- Neutrals + 1 accent color always works
- Navy + khaki, olive + cream, grey + white, burgundy + navy = proven combos
- Avoid: brown + black, navy + black, more than 1 pattern

SILHOUETTE RULES:
- Slim/tapered bottom → can wear relaxed or fitted top
- Wide/relaxed bottom → fitted top only to avoid looking shapeless

NYC ${season} CONTEXT:
- spring/fall 50-65°F: light layers, no heavy coats, chinos over shorts
- summer 75-90°F humid: breathe-first (linen, cotton), minimal layers
- winter 20-40°F: outerwear required, no shorts, no linen
- Current NYC style: clean and put-together over trendy. Fit matters more than brand.

OUTPUT: Name = short creative outfit name for the core (2-4 words, e.g. "The Uptown Edit", no quotes in output). Variant label = EXACTLY 1-2 words max (e.g. "Office", "Night Out", "Weekend", "Relaxed" — never more than 2 words). Rationale = 1-2 sentences like a friend, plain english. Style tip = one specific physical action to wear it better.

Return ONLY valid JSON:
{
  "outfits": [
    {
      "name": "The Uptown Edit",
      "core_item_ids": ["uuid_top", "uuid_bottom"],
      "rating": 9,
      "variants": [
        {
          "label": "Office",
          "item_ids": ["uuid_shoes_1", "uuid_accessory_optional"],
          "rationale": "...",
          "style_tip": "..."
        },
        {
          "label": "Night Out",
          "item_ids": ["uuid_shoes_2"],
          "rationale": "...",
          "style_tip": "..."
        }
      ]
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

    const { outfits: rawOutfits } = JSON.parse(jsonMatch[0]);

    // Hydrate first so we can compare by category
    const itemMap = new Map(items.map((i: ClothingItem) => [i.id, i]));
    type HydratedVariant = { label: string; item_ids: string[]; items: ClothingItem[]; rationale: string; style_tip: string };
    type HydratedOutfit = { name: string; core_item_ids: string[]; core_items: ClothingItem[]; rating: number; variants: HydratedVariant[] };

    const hydrated: HydratedOutfit[] = rawOutfits.map((outfit: {
      name: string; core_item_ids: string[]; rating: number;
      variants: { label: string; item_ids: string[]; rationale: string; style_tip: string }[];
    }) => ({
      ...outfit,
      core_items: outfit.core_item_ids.map((id: string) => itemMap.get(id)).filter(Boolean) as ClothingItem[],
      variants: outfit.variants.map((v) => ({
        ...v,
        items: v.item_ids.map((id: string) => itemMap.get(id)).filter(Boolean) as ClothingItem[],
      })),
    }));

    // Merge outfits that share the same shirt AND same pants, regardless of extra core items
    const TOP_CATS = new Set(["shirt", "outerwear"]);
    const BOT_CATS = new Set(["pants"]);

    const getTopId  = (o: HydratedOutfit) => o.core_items.find(it => TOP_CATS.has(it.category))?.id ?? "";
    const getBotId  = (o: HydratedOutfit) => o.core_items.find(it => BOT_CATS.has(it.category))?.id ?? "";

    const merged: HydratedOutfit[] = [];
    for (const outfit of hydrated) {
      const topId = getTopId(outfit);
      const botId = getBotId(outfit);
      if (!topId || !botId) { merged.push(outfit); continue; }

      const existing = merged.find(o => getTopId(o) === topId && getBotId(o) === botId);
      if (existing) {
        // Merge variants, deduplicate by shoes item id
        for (const v of outfit.variants) {
          const shoesId = v.items.find(it => it.category === "shoes")?.id;
          const alreadyHas = existing.variants.some(ev =>
            ev.items.find(it => it.category === "shoes")?.id === shoesId
          );
          if (!alreadyHas) existing.variants.push(v);
        }
        // Union core items (e.g. one had outerwear the other didn't)
        for (const ci of outfit.core_items) {
          if (!existing.core_items.some(ei => ei.id === ci.id)) existing.core_items.push(ci);
          if (!existing.core_item_ids.includes(ci.id)) existing.core_item_ids.push(ci.id);
        }
        existing.rating = Math.max(existing.rating, outfit.rating);
      } else {
        merged.push({ ...outfit, variants: [...outfit.variants] });
      }
    }

    // Hard-filter: remove any outfit whose shirt+pants base matches a savedCombo base
    const savedBaseKeys = new Set(
      ((savedCombos as string[][]) || []).map((ids: string[]) => getBaseKey(ids)).filter(Boolean)
    );
    const filtered = savedBaseKeys.size > 0
      ? merged.filter(o => !savedBaseKeys.has(getBaseKey(o.core_item_ids)))
      : merged;

    return Response.json({ outfits: filtered.length > 0 ? filtered : merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
