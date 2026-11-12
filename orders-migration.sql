-- Misu orders, mixed payments, daily reports; archiving preserves original orders
create extension if not exists pgcrypto;
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), customer_name text not null,
 status text not null default 'pending' check(status in ('pending','approved','paid','completed')),
 order_number integer, order_day date, created_at timestamptz not null default now(), approved_at timestamptz,
 paid_at timestamptz, total numeric(12,2) not null default 0, cash_amount numeric(12,2) not null default 0,
 card_amount numeric(12,2) not null default 0, payment_type text check(payment_type in ('cash','card','mixed'))
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 menu_item_id uuid, item_name text not null, quantity integer not null check(quantity > 0),
 unit_price numeric(12,2) not null check(unit_price >= 0), line_total numeric(12,2) not null
);
create table if not exists public.daily_order_counters(day date primary key, last_number integer not null default 0);
create table if not exists public.daily_sales_summaries(
 day date primary key, order_count integer not null, gross_total numeric(14,2) not null,
 cash_total numeric(14,2) not null, card_total numeric(14,2) not null,
 products jsonb not null default '[]'::jsonb, archived_at timestamptz not null default now()
);
create index if not exists orders_status_created_idx on public.orders(status,created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.daily_order_counters enable row level security;
alter table public.daily_sales_summaries enable row level security;
drop policy if exists "public create pending orders" on public.orders;
create policy "public create pending orders" on public.orders for insert to anon,authenticated with check(status='pending' and order_number is null and total=0);
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders" on public.orders for select to authenticated using(public.is_admin());
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "public add items to pending order" on public.order_items;
create policy "public add items to pending order" on public.order_items for insert to anon,authenticated with check(exists(select 1 from public.orders o where o.id=order_id and o.status='pending'));
drop policy if exists "admin read order items" on public.order_items;
create policy "admin read order items" on public.order_items for select to authenticated using(public.is_admin());
drop policy if exists "admin read summaries" on public.daily_sales_summaries;
create policy "admin read summaries" on public.daily_sales_summaries for select to authenticated using(public.is_admin());

create or replace function public.submit_cafe_order(p_customer_name text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_order uuid; v_total numeric(12,2):=0; v_line jsonb; v_item public.menu_items%rowtype; v_qty int;
begin
 if length(trim(coalesce(p_customer_name,''))) not between 1 and 80 then raise exception 'نام مشتری معتبر نیست'; end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'سبد خرید خالی است'; end if;
 insert into public.orders(customer_name,status,total) values(trim(p_customer_name),'pending',0) returning id into v_order;
 for v_line in select * from jsonb_array_elements(p_lines) loop
   select * into v_item from public.menu_items where id=(v_line->>'id')::uuid and available=true and is_published=true;
   if not found then raise exception 'یکی از محصولات دیگر موجود نیست'; end if;
   v_qty:=(v_line->>'quantity')::int; if v_qty<1 or v_qty>50 then raise exception 'تعداد محصول معتبر نیست'; end if;
   insert into public.order_items(order_id,menu_item_id,item_name,quantity,unit_price,line_total)
   values(v_order,v_item.id,v_item.name,v_qty,v_item.price,v_item.price*v_qty);
   v_total:=v_total+v_item.price*v_qty;
 end loop;
 update public.orders set total=v_total where id=v_order;
 return v_order;
end; $$;
grant execute on function public.submit_cafe_order(text,jsonb) to anon,authenticated;

create or replace function public.approve_cafe_order(p_order uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_day date:=(now() at time zone 'Asia/Tehran')::date; v_num int;
begin
 if not public.is_admin() then raise exception 'دسترسی مدیر لازم است'; end if;
 perform 1 from public.orders where id=p_order and status='pending' for update;
 if not found then raise exception 'سفارش در انتظار تأیید پیدا نشد'; end if;
 insert into public.daily_order_counters(day,last_number) values(v_day,1)
 on conflict(day) do update set last_number=public.daily_order_counters.last_number+1 returning last_number into v_num;
 update public.orders set status='approved',order_number=v_num,order_day=v_day,approved_at=now() where id=p_order;
 return v_num;
end; $$;
grant execute on function public.approve_cafe_order(uuid) to authenticated;

create or replace function public.settle_cafe_orders(p_order_ids uuid[],p_cash numeric,p_card numeric)
returns void language plpgsql security definer set search_path='' as $$
declare v_sum numeric(14,2); v_count int;
begin
 if not public.is_admin() then raise exception 'دسترسی مدیر لازم است'; end if;
 if coalesce(p_cash,0)<0 or coalesce(p_card,0)<0 then raise exception 'مبلغ پرداخت نامعتبر است'; end if;
 perform 1 from public.orders where id=any(p_order_ids) and status='approved' for update;
 select coalesce(sum(total),0),count(*) into v_sum,v_count from public.orders where id=any(p_order_ids) and status='approved';
 if v_count<>cardinality(p_order_ids) or v_count=0 then raise exception 'همه سفارش‌ها باید تأییدشده باشند'; end if;
 if round(coalesce(p_cash,0)+coalesce(p_card,0),2)<>round(v_sum,2) then raise exception 'جمع نقدی و کارت باید دقیقاً برابر مبلغ سفارش‌ها باشد'; end if;
 update public.orders set status='paid',paid_at=now(),cash_amount=case when v_sum=0 then 0 else coalesce(p_cash,0) end,
 card_amount=coalesce(p_card,0),payment_type=case when p_cash>0 and p_card>0 then 'mixed' when p_cash>0 then 'cash' else 'card' end
 where id=any(p_order_ids) and status='approved';
end; $$;
grant execute on function public.settle_cafe_orders(uuid[],numeric,numeric) to authenticated;

create or replace function public.archive_cafe_day(p_day date)
returns void language plpgsql security definer set search_path='' as $$
declare v_count int; v_gross numeric; v_cash numeric; v_card numeric; v_products jsonb;
begin
 if not public.is_admin() then raise exception 'دسترسی مدیر لازم است'; end if;
 select count(*),coalesce(sum(total),0),coalesce(sum(cash_amount),0),coalesce(sum(card_amount),0)
 into v_count,v_gross,v_cash,v_card from public.orders where order_day=p_day and status='paid';
 select coalesce(jsonb_agg(jsonb_build_object('name',item_name,'quantity',qty,'total',amount)),'[]'::jsonb) into v_products from
 (select oi.item_name,sum(oi.quantity)::int qty,sum(oi.line_total)::numeric amount from public.order_items oi join public.orders o on o.id=oi.order_id where o.order_day=p_day and o.status='paid' group by oi.item_name) x;
 insert into public.daily_sales_summaries(day,order_count,gross_total,cash_total,card_total,products)
 values(p_day,v_count,v_gross,v_cash,v_card,v_products)
 on conflict(day) do update set order_count=excluded.order_count,gross_total=excluded.gross_total,cash_total=excluded.cash_total,card_total=excluded.card_total,products=excluded.products,archived_at=now();
 -- Keep original orders and order_items for audit/history; do not delete sales records.
end; $$;
grant execute on function public.archive_cafe_day(date) to authenticated;
