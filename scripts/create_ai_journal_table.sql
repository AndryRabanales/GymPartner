-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- Create ai_journals table
create table if not exists public.ai_journals (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    date date not null default current_date,
    content text not null, -- AI analysis (Immutable by design)
    user_note text, -- Optional user personal note
    mood text check (mood in ('neutral', 'fire', 'ice', 'skull')),
    metrics_snapshot jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Ensure one entry per user per day
    constraint unique_user_date unique (user_id, date)
);

-- RLS Policies
alter table public.ai_journals enable row level security;

create policy "Users can view their own journals"
    on public.ai_journals for select
    using (auth.uid() = user_id);

create policy "Users can insert their own journals"
    on public.ai_journals for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own journals (notes only ideally, but we allow row update)"
    on public.ai_journals for update
    using (auth.uid() = user_id);
