-- Global straight-segment walls authored from the subhex editor.
create table if not exists public.generated_subhex_walls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  style text not null default 'wall',
  points jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_subhex_walls_style_check
    check (style in ('wall', 'palisade')),
  constraint generated_subhex_walls_points_check
    check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) >= 2)
);

create index if not exists idx_generated_subhex_walls_campaign
  on public.generated_subhex_walls (campaign_id);

alter table public.generated_subhex_walls enable row level security;

drop policy if exists "generated_subhex_walls_select_member" on public.generated_subhex_walls;
create policy "generated_subhex_walls_select_member"
on public.generated_subhex_walls
for select
to authenticated
using (
  exists (
    select 1 from public.campaign_members cm
    where cm.campaign_id = generated_subhex_walls.campaign_id
      and cm.user_id = auth.uid()
  )
);

create or replace function public.save_generated_subhex_wall(
  target_campaign_id uuid,
  target_wall_id uuid,
  target_style text,
  target_points jsonb
)
returns public.generated_subhex_walls
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_wall public.generated_subhex_walls;
  normalized_style text := lower(trim(coalesce(target_style, 'wall')));
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;
  if normalized_style not in ('wall', 'palisade') then
    raise exception 'unsupported wall style';
  end if;
  if jsonb_typeof(target_points) <> 'array' or jsonb_array_length(target_points) < 2 then
    raise exception 'a wall requires at least two anchors';
  end if;

  if target_wall_id is not null then
    update public.generated_subhex_walls
    set style = normalized_style,
        points = target_points,
        updated_at = now()
    where id = target_wall_id
      and campaign_id = target_campaign_id
    returning * into saved_wall;
  end if;

  if saved_wall.id is null then
    insert into public.generated_subhex_walls (campaign_id, style, points, created_by)
    values (target_campaign_id, normalized_style, target_points, auth.uid())
    returning * into saved_wall;
  end if;
  return saved_wall;
end;
$$;

create or replace function public.delete_generated_subhex_wall(
  target_campaign_id uuid,
  target_wall_id uuid
)
returns public.generated_subhex_walls
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_wall public.generated_subhex_walls;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;
  delete from public.generated_subhex_walls
  where id = target_wall_id
    and campaign_id = target_campaign_id
  returning * into deleted_wall;
  if deleted_wall.id is null then raise exception 'Wall not found.'; end if;
  return deleted_wall;
end;
$$;

revoke all on function public.save_generated_subhex_wall(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.delete_generated_subhex_wall(uuid, uuid) from public, anon;
grant execute on function public.save_generated_subhex_wall(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.delete_generated_subhex_wall(uuid, uuid) to authenticated;
grant select on public.generated_subhex_walls to authenticated;

notify pgrst, 'reload schema';
