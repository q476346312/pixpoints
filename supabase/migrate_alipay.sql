-- ============================================================
-- 积分素材站 · 充值系统 SQL 迁移（支付宝当面付）
-- 运行于 Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. 给 topup_orders 加新字段（不影响旧数据）
alter table public.topup_orders
  add column if not exists order_id     text unique,
  add column if not exists out_trade_no text,
  add column if not exists amount       numeric(10,2),
  add column if not exists points       bigint,
  add column if not exists paid_at      timestamptz,
  add column if not exists trade_no     text,
  add column if not exists buyer_account text;

-- 2. inc_points RPC 函数（给前端 query 接口用）
create or replace function public.inc_points(uid uuid, delta bigint)
returns void
language plpgsql
security definer
as $$
begin
  update public.users
  set points = points + delta
  where id = uid;
end;
$$;

-- 3. 确保已有的函数（兼容旧代码）
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

create or replace function public.increment_points(p_user_id uuid, p_points bigint)
returns void
language plpgsql
security definer
as $$
begin
  update public.users set points = points + p_points where id = p_user_id;
end;
$$;

-- 4. RLS：topup_orders 允许 service_role 任意读写（无需改）
-- 已有 policy 足够，service_role key 绑过了，不用动
