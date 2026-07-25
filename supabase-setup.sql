-- Run this in Supabase SQL Editor
-- Project: Dripson (style-ai)
-- NEW: Run these additions for rating + profile features

-- Add rating column to outfit_history
alter table outfit_history add column if not exists user_rating integer check (user_rating between 1 and 5);

-- User profile table (single row)
create table if not exists user_profile (
  id uuid primary key default gen_random_uuid(),
  profile_image_url text,
  physique_notes text,
  style_preferences text,
  updated_at timestamptz default now()
);
alter table user_profile enable row level security;
create policy "Allow all" on user_profile for all using (true) with check (true);

-- (tables below already exist if you ran the original setup)


-- Clothing items table
create table if not exists clothing_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  subcategory text,
  color text,
  colors text[] default '{}',
  style text,
  formality_level integer default 3,
  seasons text[] default '{}',
  occasions text[] default '{}',
  image_url text not null,
  ai_description text,
  tags jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Outfit history table
create table if not exists outfit_history (
  id uuid primary key default gen_random_uuid(),
  item_ids uuid[] not null,
  occasion text not null,
  season text not null,
  style_rationale text,
  worn_date date default current_date,
  created_at timestamptz default now()
);

-- Row Level Security
alter table clothing_items enable row level security;
alter table outfit_history enable row level security;

create policy "Allow all" on clothing_items for all using (true) with check (true);
create policy "Allow all" on outfit_history for all using (true) with check (true);
