-- Thumbnails for stories published before thumbnail columns existed:
-- the cover if there is one, else the first figure in the published content.
update public.stories s
set
  thumbnail_url = coalesce(s.cover_url, first_figure.src),
  thumbnail_alt = case when s.cover_url is not null then s.cover_alt else coalesce(first_figure.alt, '') end
from public.stories src
left join lateral (
  select block -> 'attrs' ->> 'src' as src, block -> 'attrs' ->> 'alt' as alt
  from jsonb_array_elements(coalesce(src.content -> 'content', '[]'::jsonb)) with ordinality as blocks(block, position)
  where block ->> 'type' = 'figure'
  order by position
  limit 1
) first_figure on true
where s.id = src.id
  and s.thumbnail_url is null
  and (s.cover_url is not null or first_figure.src is not null);
