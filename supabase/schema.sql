-- =============================================
-- 积分素材站 · Supabase 数据库初始化 SQL
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================

-- 1. 用户表（账号 + 密码模式）
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,               -- 登录账号
  password_hash text not null,                       -- SHA256 密码哈希
  points        bigint not null default 0,
  created_at    timestamptz not null default now()
);

-- 2. 素材表
create table if not exists public.materials (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  file_url       text not null,
  thumbnail_url  text,
  cost_points    bigint not null default 100,
  downloads_left int,                               -- null = 不限次数
  delete_after_download boolean not null default false,  -- 下载后是否删除
  purchased_users uuid[] default '{}',              -- 已购买的用户ID列表
  category       text,
  created_at     timestamptz not null default now()
);

-- 3. 充值订单表
create table if not exists public.topup_orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete set null,
  user_email    text not null,
  usd_amount    numeric(10, 2) not null,
  points_added  bigint not null,
  payoneer_ref  text,
  status        text not null default 'pending',   -- pending | completed | failed
  created_at    timestamptz not null default now()
);

-- 4. 扣除积分函数（防负数）
create or replace function public.deduct_points(p_user_id uuid, p_points bigint)
returns void
language plpgsql
security definer
as $$
begin
  if (select points from public.users where id = p_user_id) < p_points then
    raise exception '积分不足';
  end if;
  update public.users set points = points - p_points where id = p_user_id;
end;
$$;

-- 5. 增加积分函数
create or replace function public.increment_points(p_user_id uuid, p_points bigint)
returns void
language plpgsql
security definer
as $$
begin
  update public.users set points = points + p_points where id = p_user_id;
end;
$$;

-- 6. RLS 策略（行级安全）
alter table public.users     enable row level security;
alter table public.materials  enable row level security;
alter table public.topup_orders enable row level security;

-- 用户只能读自己的数据
create policy "users_select_own" on public.users for select using (true);
create policy "users_update_own" on public.users for update using (true);

-- 素材：所有人可读，admin 可写
create policy "materials_select_all" on public.materials for select using (true);
create policy "materials_insert_all" on public.materials for insert with check (true);
create policy "materials_update_all" on public.materials for update using (true);
create policy "materials_delete_all" on public.materials for delete using (true);

-- 订单：所有人可读自己的，admin 可写
create policy "orders_select_all" on public.topup_orders for select using (true);
create policy "orders_insert_all" on public.topup_orders for insert with check (true);
create policy "orders_update_all" on public.topup_orders for update using (true);

-- 7. 存储 Bucket
insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict (id) do nothing;

-- Storage policies
create policy "materials_storage_read" on storage.objects for select using (bucket_id = 'materials');
create policy "materials_storage_upload" on storage.objects for insert with check (bucket_id = 'materials');
create policy "materials_storage_delete" on storage.objects for delete using (bucket_id = 'materials');
