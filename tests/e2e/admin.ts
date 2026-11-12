import type { Page } from "@playwright/test";
import postgres from "postgres";
import { signInWithMagicLink } from "./sign-in";

/** Local test database only: marks an account as admin (what the Supabase dashboard does in production). */
export async function setAdmin(email: string, admin: boolean) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      update auth.users
      set raw_app_meta_data = case when ${admin} then raw_app_meta_data || '{"role":"admin"}'::jsonb
                                   else raw_app_meta_data - 'role' end
      where email = ${email}`;
  } finally {
    await sql.end();
  }
}

/** Makes a signed-in account admin and signs in again so the session carries the role. */
export async function becomeAdmin(page: Page, email: string) {
  await setAdmin(email, true);
  await page.getByTestId("account-menu").click();
  await page.getByTestId("sign-out").click();
  await signInWithMagicLink(page, "en", email);
}

/** Local test database only: removes every featured entry of a week's spark, so runs start clean. */
export async function clearFeatures(weekOf: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`delete from public.prompt_features where prompt_id in (select id from public.prompts where week_of = ${weekOf}::date)`;
  } finally {
    await sql.end();
  }
}
