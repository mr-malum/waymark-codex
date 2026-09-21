-- Per-POI visibility for the normal map's subhex view only.
alter table public.pois
add column if not exists subhex_visible boolean not null default true;

create or replace function public.set_poi_subhex_visibility(
  target_campaign_id uuid,
  target_poi_id uuid,
  show_in_subhex boolean
)
returns public.pois
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_poi public.pois;
begin
  if auth.uid() is null or not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if show_in_subhex is null then
    raise exception 'subhex visibility is required';
  end if;

  update public.pois
  set subhex_visible = show_in_subhex,
      updated_at = now()
  where campaign_id = target_campaign_id
    and id = target_poi_id
  returning * into updated_poi;

  if updated_poi.id is null then
    raise exception 'POI not found';
  end if;

  return updated_poi;
end;
$$;

revoke all on function public.set_poi_subhex_visibility(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_poi_subhex_visibility(uuid, uuid, boolean) to authenticated;
