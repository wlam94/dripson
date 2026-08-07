export type Category = 'shirt' | 'pants' | 'shoes' | 'accessory' | 'outerwear' | 'other'
export type Season = 'spring' | 'summer' | 'fall' | 'winter'
export type Occasion = 'casual' | 'work' | 'date_night' | 'workout'

export interface ClothingItem {
  id: string
  category: Category
  subcategory: string | null
  color: string
  colors: string[]
  style: string
  seasons: Season[]
  occasions: Occasion[]
  image_url: string
  ai_description: string
  tags: Record<string, string> | null
  is_active: boolean
  created_at: string
}

export interface OutfitHistoryEntry {
  id: string
  item_ids: string[]
  occasion: Occasion
  season: Season
  style_rationale: string
  worn_date: string
  created_at: string
  user_rating: number | null
  items?: ClothingItem[]
}


export interface OutfitRecommendation {
  items: ClothingItem[]
  rationale: string
  occasion: Occasion
  season: Season
}

