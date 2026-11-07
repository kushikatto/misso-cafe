-- فقط برای فعال‌کردن آپلود تصاویر منو در Supabase
-- این فایل را در SQL Editor اجرا کنید. جدول‌های منو و پروفایل را دوباره نمی‌سازد.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "menu images public read" on storage.objects;
create policy "menu images public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'menu-images');

drop policy if exists "menu images admin upload" on storage.objects;
create policy "menu images admin upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'menu-images' and (select public.is_admin()));

drop policy if exists "menu images admin update" on storage.objects;
create policy "menu images admin update"
on storage.objects for update
to authenticated
using (bucket_id = 'menu-images' and (select public.is_admin()))
with check (bucket_id = 'menu-images' and (select public.is_admin()));

drop policy if exists "menu images admin delete" on storage.objects;
create policy "menu images admin delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'menu-images' and (select public.is_admin()));
