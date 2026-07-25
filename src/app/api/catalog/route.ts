import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase, WARDROBE_BUCKET } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const categoryHint = (form.get("category") as string) || "other";

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    // Claude Vision analysis
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `You are a world-class men's fashion stylist analyzing a clothing item photo.
The user has hinted the category is: ${categoryHint}.

Analyze this clothing item and return ONLY valid JSON with this exact structure:
{
  "category": "shirt|pants|shoes|accessory|outerwear|other",
  "subcategory": "e.g. oxford shirt, chino, chelsea boot, etc.",
  "color": "primary color name",
  "colors": ["color1", "color2"],
  "style": "smart casual|business casual|casual|formal|athletic",
  "formality_level": 1-5,
  "seasons": ["spring","summer","fall","winter"],
  "occasions": ["casual","work","date_night","workout"],
  "ai_description": "2-3 sentence stylist description of the piece and how to wear it"
}

formality_level: 1=athletic/loungewear, 2=casual, 3=smart casual, 4=business casual, 5=formal.
Be specific and accurate. Only include seasons and occasions where this piece truly works.`,
            },
          ],
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Claude could not parse the image" }, { status: 422 });
    }
    const analysis = JSON.parse(jsonMatch[0]);

    // Upload image to Supabase Storage
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const sb = getSupabase();
    const { error: storageError } = await sb.storage
      .from(WARDROBE_BUCKET)
      .upload(filename, buffer, { contentType: file.type });

    if (storageError) {
      return Response.json({ error: `Storage error: ${storageError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = sb.storage.from(WARDROBE_BUCKET).getPublicUrl(filename);

    // Save to DB
    const { data, error: dbError } = await sb
      .from("clothing_items")
      .insert({
        category: analysis.category,
        subcategory: analysis.subcategory,
        color: analysis.color,
        colors: analysis.colors,
        style: analysis.style,
        formality_level: analysis.formality_level,
        seasons: analysis.seasons,
        occasions: analysis.occasions,
        image_url: publicUrlData.publicUrl,
        ai_description: analysis.ai_description,
        tags: null,
        is_active: true,
      })
      .select()
      .single();

    if (dbError) {
      return Response.json({ error: `DB error: ${dbError.message}` }, { status: 500 });
    }

    return Response.json({ item: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
