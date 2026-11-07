-- Rate limits: one row per counted action, kept only as long as the longest window. Written and
-- read only through take_rate_limit() (security definer); nobody can see or change the table.
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  subject text not null,
  created_at timestamptz not null default now()
);
--> statement-breakpoint
create index rate_limit_hits_lookup on public.rate_limit_hits (bucket, subject, created_at);
--> statement-breakpoint
alter table public.rate_limit_hits enable row level security;
--> statement-breakpoint
revoke all on public.rate_limit_hits from anon, authenticated;
--> statement-breakpoint

-- Counts `subject`'s hits in `bucket` over the last `per`; below `max_hits` it records one more and
-- returns true, otherwise false (and records nothing). The advisory lock keeps two simultaneous
-- requests from both slipping under the limit.
create or replace function public.take_rate_limit(bucket text, subject text, max_hits integer, per interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  if bucket is null or subject is null or max_hits is null or per is null then
    raise exception 'take_rate_limit needs a bucket, subject, limit and window' using errcode = '22004';
  end if;
  perform pg_advisory_xact_lock(hashtext(bucket || ':' || subject));
  select count(*) into used
  from public.rate_limit_hits h
  where h.bucket = take_rate_limit.bucket and h.subject = take_rate_limit.subject and h.created_at > now() - per;
  if used >= max_hits then
    return false;
  end if;
  insert into public.rate_limit_hits (bucket, subject) values (take_rate_limit.bucket, take_rate_limit.subject);
  return true;
end;
$$;
--> statement-breakpoint
revoke execute on function public.take_rate_limit(text, text, integer, interval) from public;
--> statement-breakpoint
grant execute on function public.take_rate_limit(text, text, integer, interval) to anon, authenticated;
--> statement-breakpoint

-- The daily job forgets hits older than any window (2 days).
create or replace function public.prune_rate_limits()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.rate_limit_hits where created_at < now() - interval '2 days' returning 1)
  select count(*)::int from gone;
$$;
--> statement-breakpoint
revoke execute on function public.prune_rate_limits() from public, anon, authenticated;
