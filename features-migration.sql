-- Misu Cafe: additive features migration (safe to run after existing setup)
-- Does not drop or recreate existing menu/order tables.
create extension if not exists pgcrypto;

create table if not exists public.menu_extras (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 price numeric(12,2) not null default 0 check(price>=0),
 max_quantity integer check(max_quantity is null or max_quantity>=1),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.product_extras (
 menu_item_id uuid not null references public.menu_items(id) on delete cascade,
 extra_id uuid not null references public.menu_extras(id) on delete cascade,
 primary key(menu_item_id,extra_id)
);
create table if not exists public.product_discounts (
 id uuid primary key default gen_random_uuid(),
 menu_item_id uuid not null unique references public.menu_items(id) on delete cascade,
 percent numeric(5,2) not null check(percent>0 and percent<=100),
 starts_at timestamptz,
 ends_at timestamptz,
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.coupon_codes (
 id uuid primary key default gen_random_uuid(),
 code text not null unique,
 discount_type text not null check(discount_type in ('percent','fixed')),
 discount_value numeric(12,2) not null check(discount_value>0),
 starts_at timestamptz,
 ends_at timestamptz,
 usage_limit integer check(usage_limit is null or usage_limit>=1),
 used_count integer not null default 0 check(used_count>=0),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.cafe_events (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 image_url text,
 starts_at timestamptz,
 ends_at timestamptz,
 min_attendees integer not null default 1 check(min_attendees>=1),
 prepayment_percent numeric(5,2) not null default 0 check(prepayment_percent between 0 and 100),
 status text not null default 'published' check(status in ('draft','published','cancelled','completed')),
 created_at timestamptz not null default now()
);
create table if not exists public.event_registrations (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.cafe_events(id) on delete cascade,
 customer_name text not null,
 phone text not null,
 attendee_count integer not null check(attendee_count>=1),
 created_at timestamptz not null default now()
);
create table if not exists public.event_manual_items (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.cafe_events(id) on delete cascade,
 registration_id uuid references public.event_registrations(id) on delete set null,
 title text not null,
 price numeric(12,2) not null check(price>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.music_suggestions (
 id uuid primary key default gen_random_uuid(),
 suggested_by text not null default 'مهمان',
 song_title text not null,
 artist text not null default '',
 status text not null default 'new' check(status in ('new','approved','rejected','played')),
 created_at timestamptz not null default now()
);
create table if not exists public.event_payment_settings (
 id boolean primary key default true check(id),
 provider text not null default 'disabled',
 public_config jsonb not null default '{}'::jsonb,
 is_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.event_payment_settings(id,provider,is_enabled)
values(true,'disabled',false) on conflict(id) do nothing;

alter table public.menu_extras enable row level security;
alter table public.product_extras enable row level security;
alter table public.product_discounts enable row level security;
alter table public.coupon_codes enable row level security;
alter table public.cafe_events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_manual_items enable row level security;
alter table public.music_suggestions enable row level security;
alter table public.event_payment_settings enable row level security;

drop policy if exists "public read active extras" on public.menu_extras;
create policy "public read active extras" on public.menu_extras for select to anon,authenticated using(is_active or public.is_admin());
drop policy if exists "admin manage extras" on public.menu_extras;
create policy "admin manage extras" on public.menu_extras for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public read product extras" on public.product_extras;
create policy "public read product extras" on public.product_extras for select to anon,authenticated using(true);
drop policy if exists "admin manage product extras" on public.product_extras;
create policy "admin manage product extras" on public.product_extras for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public read active discounts" on public.product_discounts;
create policy "public read active discounts" on public.product_discounts for select to anon,authenticated using(is_active or public.is_admin());
drop policy if exists "admin manage discounts" on public.product_discounts;
create policy "admin manage discounts" on public.product_discounts for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public read active coupons" on public.coupon_codes;
create policy "public read active coupons" on public.coupon_codes for select to anon,authenticated using(is_active or public.is_admin());
drop policy if exists "admin manage coupons" on public.coupon_codes;
create policy "admin manage coupons" on public.coupon_codes for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public read published events" on public.cafe_events;
create policy "public read published events" on public.cafe_events for select to anon,authenticated using(status='published' or public.is_admin());
drop policy if exists "admin manage events" on public.cafe_events;
create policy "admin manage events" on public.cafe_events for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public register for event" on public.event_registrations;
create policy "public register for event" on public.event_registrations for insert to anon,authenticated with check(length(trim(customer_name)) between 1 and 80 and length(trim(phone)) between 7 and 24 and attendee_count between 1 and 30);
drop policy if exists "admin read registrations" on public.event_registrations;
create policy "admin read registrations" on public.event_registrations for select to authenticated using(public.is_admin());
drop policy if exists "admin manage registrations" on public.event_registrations;
create policy "admin manage registrations" on public.event_registrations for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admin manage event manual items" on public.event_manual_items;
create policy "admin manage event manual items" on public.event_manual_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public suggest music" on public.music_suggestions;
create policy "public suggest music" on public.music_suggestions for insert to anon,authenticated with check(length(trim(song_title)) between 1 and 120 and length(trim(suggested_by))<=80);
drop policy if exists "admin read music suggestions" on public.music_suggestions;
create policy "admin read music suggestions" on public.music_suggestions for select to authenticated using(public.is_admin());
drop policy if exists "admin update music suggestions" on public.music_suggestions;
create policy "admin update music suggestions" on public.music_suggestions for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admin manage payment settings" on public.event_payment_settings;
create policy "admin manage payment settings" on public.event_payment_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Registration count is calculated from attendee_count; public access reveals no phone/name.
create or replace function public.public_event_counts()
returns table(event_id uuid, attendee_total bigint)
language sql stable security definer set search_path='' as $$
 select e.id, coalesce(sum(r.attendee_count),0)::bigint
 from public.cafe_events e left join public.event_registrations r on r.event_id=e.id
 where e.status='published' group by e.id;
$$;
grant execute on function public.public_event_counts() to anon,authenticated;

-- Server-side validation helper for event registration; registration rows are still protected by RLS.
create or replace function public.register_cafe_event(p_event uuid,p_name text,p_phone text,p_count integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'نام معتبر نیست'; end if;
 if length(trim(coalesce(p_phone,''))) not between 7 and 24 then raise exception 'شماره تماس معتبر نیست'; end if;
 if p_count not between 1 and 30 then raise exception 'تعداد نفرات معتبر نیست'; end if;
 if not exists(select 1 from public.cafe_events where id=p_event and status='published' and (ends_at is null or ends_at>now())) then raise exception 'ثبت‌نام این رویداد فعال نیست'; end if;
 insert into public.event_registrations(event_id,customer_name,phone,attendee_count)
 values(p_event,trim(p_name),trim(p_phone),p_count) returning id into v_id;
 return v_id;
end; $$;
grant execute on function public.register_cafe_event(uuid,text,text,integer) to anon,authenticated;

create or replace function public.submit_music_suggestion(p_name text,p_song text,p_artist text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if length(trim(coalesce(p_song,''))) not between 1 and 120 then raise exception 'نام آهنگ معتبر نیست'; end if;
 insert into public.music_suggestions(suggested_by,song_title,artist)
 values(left(trim(coalesce(p_name,'مهمان')),80),trim(p_song),left(trim(coalesce(p_artist,'')),120))
 returning id into v_id;
 return v_id;
end; $$;
grant execute on function public.submit_music_suggestion(text,text,text) to anon,authenticated;


-- Final checkout integration: extras, scheduled product discounts and coupons.
-- Additive only; existing order rows remain intact.
alter table public.orders add column if not exists discount_total numeric(12,2) not null default 0;
alter table public.orders add column if not exists coupon_code text;
create table if not exists public.order_item_extras(
 id uuid primary key default gen_random_uuid(),
 order_item_id uuid not null references public.order_items(id) on delete cascade,
 extra_id uuid references public.menu_extras(id) on delete set null,
 extra_name text not null,
 quantity integer not null check(quantity between 1 and 50),
 unit_price numeric(12,2) not null check(unit_price>=0),
 line_total numeric(12,2) not null check(line_total>=0)
);
alter table public.order_item_extras enable row level security;
drop policy if exists "admin read order item extras" on public.order_item_extras;
create policy "admin read order item extras" on public.order_item_extras for select to authenticated using(public.is_admin());

create or replace function public.submit_cafe_order_v2(p_customer_name text,p_lines jsonb,p_coupon_code text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_order uuid; v_total numeric(12,2):=0; v_subtotal numeric(12,2):=0;
 v_discount numeric(12,2):=0; v_coupon_discount numeric(12,2):=0; v_line jsonb; v_extra jsonb;
 v_item public.menu_items%rowtype; v_qty int; v_item_discount numeric(5,2);
 v_base numeric(12,2); v_extra_total numeric(12,2); v_order_item uuid;
 v_extra_row public.menu_extras%rowtype; v_extra_qty int;
 v_coupon public.coupon_codes%rowtype; v_code text;
begin
 if length(trim(coalesce(p_customer_name,''))) not between 1 and 80 then raise exception 'نام مشتری معتبر نیست'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 or jsonb_array_length(p_lines)>30 then raise exception 'سبد خرید معتبر نیست'; end if;
 insert into public.orders(customer_name,status,total) values(trim(p_customer_name),'pending',0) returning id into v_order;
 for v_line in select * from jsonb_array_elements(p_lines) loop
   select * into v_item from public.menu_items where id=(v_line->>'id')::uuid and available=true and is_published=true;
   if not found then raise exception 'یکی از محصولات دیگر موجود نیست'; end if;
   v_qty:=(v_line->>'quantity')::int;
   if v_qty<1 or v_qty>50 then raise exception 'تعداد محصول معتبر نیست'; end if;
   v_base:=v_item.price*v_qty;
   select percent into v_item_discount from public.product_discounts
    where menu_item_id=v_item.id and is_active=true
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
    order by created_at desc limit 1;
   if v_item_discount is not null then
     v_discount:=v_discount+round(v_base*v_item_discount/100,2);
     v_base:=v_base-round(v_base*v_item_discount/100,2);
   end if;
   insert into public.order_items(order_id,menu_item_id,item_name,quantity,unit_price,line_total)
   values(v_order,v_item.id,v_item.name,v_qty,v_item.price,v_base) returning id into v_order_item;
   v_extra_total:=0;
   if jsonb_typeof(coalesce(v_line->'extras','[]'::jsonb))<>'array' then raise exception 'افزودنی نامعتبر است'; end if;
   for v_extra in select * from jsonb_array_elements(coalesce(v_line->'extras','[]'::jsonb)) loop
     select me.* into v_extra_row from public.menu_extras me
       join public.product_extras pe on pe.extra_id=me.id
       where me.id=(v_extra->>'id')::uuid and pe.menu_item_id=v_item.id and me.is_active=true;
     if not found then raise exception 'افزودنی برای این محصول مجاز نیست'; end if;
     v_extra_qty:=(v_extra->>'quantity')::int;
     if v_extra_qty<1 or v_extra_qty>50 or (v_extra_row.max_quantity is not null and v_extra_qty>v_extra_row.max_quantity) then raise exception 'تعداد افزودنی معتبر نیست'; end if;
     -- The extra price is charged once per extra type, not multiplied by its selected quantity.
     insert into public.order_item_extras(order_item_id,extra_id,extra_name,quantity,unit_price,line_total)
     values(v_order_item,v_extra_row.id,v_extra_row.name,v_extra_qty,v_extra_row.price,v_extra_row.price);
     v_extra_total:=v_extra_total+v_extra_row.price;
   end loop;
   v_subtotal:=v_subtotal+v_base+v_extra_total;
 end loop;
 v_total:=v_subtotal;
 v_code:=upper(trim(coalesce(p_coupon_code,'')));
 if v_code<>'' then
   select * into v_coupon from public.coupon_codes
    where code=v_code and is_active=true
    and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())
    for update;
   if not found then raise exception 'کد تخفیف معتبر یا فعال نیست'; end if;
   if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then raise exception 'ظرفیت استفاده از کد تخفیف تمام شده است'; end if;
   if v_coupon.discount_type='percent' then v_coupon_discount:=round(v_total*v_coupon.discount_value/100,2);
   else v_coupon_discount:=least(v_total,v_coupon.discount_value); end if;
   update public.coupon_codes set used_count=used_count+1 where id=v_coupon.id;
   v_code:=v_coupon.code;
 end if;
 v_coupon_discount:=least(v_coupon_discount,v_subtotal);
 v_discount:=v_discount+v_coupon_discount;
 v_total:=greatest(0,v_subtotal-v_coupon_discount);
 update public.orders set total=v_total,discount_total=v_discount,coupon_code=nullif(v_code,'') where id=v_order;
 return v_order;
exception when others then
 if v_order is not null then delete from public.orders where id=v_order; end if;
 raise;
end; $$;
grant execute on function public.submit_cafe_order_v2(text,jsonb,text) to anon,authenticated;

-- Admin can attach allowed extras to a product through this table.
drop policy if exists "admin manage order item extras" on public.order_item_extras;
create policy "admin manage order item extras" on public.order_item_extras for all to authenticated using(public.is_admin()) with check(public.is_admin());


-- Optional event attribution for normal menu orders placed by registered guests.
alter table public.orders add column if not exists event_id uuid references public.cafe_events(id) on delete set null;
alter table public.orders add column if not exists event_registration_id uuid references public.event_registrations(id) on delete set null;

create or replace function public.submit_cafe_event_order(
 p_customer_name text,p_lines jsonb,p_coupon_code text default null,
 p_event_id uuid default null,p_registration_phone text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_order uuid; v_registration uuid;
begin
 v_order:=public.submit_cafe_order_v2(p_customer_name,p_lines,p_coupon_code);
 if p_event_id is not null then
   select id into v_registration from public.event_registrations
    where event_id=p_event_id and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(coalesce(p_registration_phone,''),'[^0-9]','','g')
      and customer_name=trim(p_customer_name)
    order by created_at desc limit 1;
   if v_registration is null then raise exception 'ثبت‌نام رویداد با این نام و شماره تماس پیدا نشد'; end if;
   update public.orders set event_id=p_event_id,event_registration_id=v_registration where id=v_order;
 end if;
 return v_order;
end; $$;
grant execute on function public.submit_cafe_event_order(text,jsonb,text,uuid,text) to anon,authenticated;
