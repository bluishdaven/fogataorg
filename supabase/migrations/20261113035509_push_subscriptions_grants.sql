-- Push subscriptions (docs/plans/app.md): readers see and remove their own devices; saving goes
-- through save_push_subscription() only.
revoke all on public.push_subscriptions from anon, authenticated;
--> statement-breakpoint
grant select, delete on public.push_subscriptions to authenticated;
--> statement-breakpoint
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
--> statement-breakpoint

-- Saves this device for the signed-in person. A push address is a secret the browser hands out, so
-- whoever has it owns it: a device that changed hands (someone signed out, someone else signed in)
-- moves to the new person instead of failing on the unique address. Ten devices each at most; the
-- least recently saved go first. The app checks the address belongs to a push service.
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_locale public.locale_code
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, locale)
  values (uid, p_endpoint, p_p256dh, p_auth, p_locale)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, locale = excluded.locale;
  delete from public.push_subscriptions
  where id in (
    select s.id from public.push_subscriptions s where s.user_id = uid order by s.updated_at desc, s.created_at desc offset 10
  );
end;
$$;
--> statement-breakpoint
revoke execute on function public.save_push_subscription(text, text, text, public.locale_code) from public, anon;
--> statement-breakpoint
grant execute on function public.save_push_subscription(text, text, text, public.locale_code) to authenticated;
