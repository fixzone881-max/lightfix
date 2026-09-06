-- Run this once in the Supabase SQL editor (or via `psql`) to set up the schema.

create extension if not exists "uuid-ossp";

-- App users (the creators/agencies who sign up for the tool)
create table if not exists app_users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  password_hash text not null,
  full_name text,
  plan text not null default 'free', -- free | starter | pro
  created_at timestamptz not null default now()
);

-- Connected Instagram/Facebook accounts (one app_user can connect several)
create table if not exists ig_accounts (
  id uuid primary key default uuid_generate_v4(),
  app_user_id uuid not null references app_users(id) on delete cascade,
  ig_business_id text not null,          -- Instagram Business Account ID from Graph API
  fb_page_id text,                       -- linked Facebook Page ID
  username text,
  access_token text not null,            -- long-lived page access token
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  unique (app_user_id, ig_business_id)
);

-- Automation rules: "when X happens on this account, do Y"
create table if not exists automations (
  id uuid primary key default uuid_generate_v4(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  name text not null,
  trigger_type text not null,   -- comment_keyword | dm_keyword | story_reply | live_comment | post_share
  keywords text[] default '{}', -- match list; empty = match anything
  require_follow boolean default false,
  reply_public_comment text,    -- optional public reply, e.g. "Sent you a DM! 🎉"
  dm_message text not null,     -- base DM text; AI creates variants of this at send time
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Every inbound comment/DM/event we've seen, and what we did with it
create table if not exists events_log (
  id uuid primary key default uuid_generate_v4(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  automation_id uuid references automations(id) on delete set null,
  event_type text not null,       -- comment | dm | story_reply | live_comment | share
  sender_ig_id text,
  sender_username text,
  content text,
  matched boolean default false,
  moderation_action text,         -- null | hidden_spam | hidden_hate | hidden_competitor
  is_brand_deal boolean default false,
  created_at timestamptz not null default now()
);

-- Outbound DM queue (rate-limited sender reads from here)
create table if not exists dm_queue (
  id uuid primary key default uuid_generate_v4(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  recipient_ig_id text not null,
  message text not null,
  status text not null default 'pending', -- pending | sent | failed
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Digital products a creator sells inside DMs
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  title text not null,
  description text,
  price_cents int not null,
  currency text not null default 'usd',
  file_url text not null,          -- signed Supabase Storage URL or external link
  stripe_price_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists product_sales (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  buyer_ig_id text,
  buyer_email text,
  amount_cents int not null,
  stripe_session_id text,
  fulfilled boolean default false,
  created_at timestamptz not null default now()
);

-- Leads collected via automations (name/email/phone captured in DM flows)
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  ig_account_id uuid not null references ig_accounts(id) on delete cascade,
  ig_id text,
  username text,
  email text,
  phone text,
  source_automation_id uuid references automations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_log_account on events_log(ig_account_id, created_at desc);
create index if not exists idx_dm_queue_status on dm_queue(status, scheduled_for);
