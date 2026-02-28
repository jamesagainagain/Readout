-- Run this in Supabase SQL Editor

create table if not exists product_knowledge (
  id uuid primary key default gen_random_uuid(),
  repo_owner text not null,
  repo_name text not null,
  chunks jsonb not null default '[]'::jsonb,
  summary jsonb,
  last_synced_at timestamptz default now(),
  unique(repo_owner, repo_name)
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid references product_knowledge(id) on delete cascade,
  audience text not null,
  tone text not null,
  goals text,
  channels text[] default '{}',
  constraints text,
  created_at timestamptz default now()
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid references briefs(id) on delete cascade,
  channel text not null,
  title text,
  body text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists subreddits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  public_description text,
  subscribers int,
  over18 boolean default false,
  rules jsonb,
  topic text,
  engagement_avg_score numeric,
  engagement_posts_per_day numeric,
  last_synced_at timestamptz default now()
);
