-- Run this entire script in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'customer' check (role in ('admin','customer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.menu_pages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.menu_pages(id) on delete cascade,
  name text not null,
  description text default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'تومان',
  image_url text,
  available boolean not null default true,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists menu_items_page_id_idx on public.menu_items(page_id);
alter table public.profiles enable row level security;
alter table public.menu_pages enable row level security;
alter table public.menu_items enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "public read published pages" on public.menu_pages;
create policy "public read published pages" on public.menu_pages for select to anon, authenticated
using (is_published = true or public.is_admin());
drop policy if exists "admin manage pages" on public.menu_pages;
create policy "admin manage pages" on public.menu_pages for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read published items" on public.menu_items;
create policy "public read published items" on public.menu_items for select to anon, authenticated
using (is_published = true or public.is_admin());
drop policy if exists "admin manage items" on public.menu_items;
create policy "admin manage items" on public.menu_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('menu-images','menu-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "public view menu images" on storage.objects;
create policy "public view menu images" on storage.objects for select to anon, authenticated
using (bucket_id = 'menu-images');
drop policy if exists "admin upload menu images" on storage.objects;
create policy "admin upload menu images" on storage.objects for insert to authenticated
with check (bucket_id = 'menu-images' and public.is_admin());
drop policy if exists "admin update menu images" on storage.objects;
create policy "admin update menu images" on storage.objects for update to authenticated
using (bucket_id = 'menu-images' and public.is_admin())
with check (bucket_id = 'menu-images' and public.is_admin());
drop policy if exists "admin delete menu images" on storage.objects;
create policy "admin delete menu images" on storage.objects for delete to authenticated
using (bucket_id = 'menu-images' and public.is_admin());

-- IMPORTANT: create your admin account in Supabase Authentication first.
-- Then replace USER_AUTH_UUID below and run:
-- update public.profiles set role = 'admin' where id = 'USER_AUTH_UUID';
