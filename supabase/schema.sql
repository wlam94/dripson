-- Run this in your Supabase SQL Editor

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

-- Enable RLS (Row Level Security) — for single user personal app, allow all
alter table clothing_items enable row level security;
alter table outfit_history enable row level security;

create policy "Allow all" on clothing_items for all using (true) with check (true);
create policy "Allow all" on outfit_history for all using (true) with check (true);

-- Storage bucket: run this after creating the bucket named "wardrobe" in Storage UI
-- insert into storage.buckets (id, name, public) values ('wardrobe', 'wardrobe', true);
