import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { deleteFromMyStories, publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

/** Unique even when tests start in the same millisecond (digits only, so it stays a valid slug). */
const circleName = () => `E2E circle ${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function createCircle(page: Page, name: string, { private: isPrivate = false } = {}): Promise<string> {
  await page.goto("/en/circles");
  await page.getByTestId("start-circle").click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("What it's about").fill("Stories written near water.");
  await page.getByRole("button", { name: "Accent #1d4ed8" }).click();
  if (isPrivate) await page.getByRole("radio", { name: /^Private/ }).check();
  await page.getByTestId("circle-submit").click();
  await expect(page).toHaveURL(/\/en\/circles\/e2e-circle-\d+$/);
  return page.url();
}

async function axeSerious(page: Page) {
  // Toasts animate their opacity (axe reads that as low contrast) and pause while the page is
  // unfocused, so leave them out; they use the same popover tokens checked on every page.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("writers submit to a circle, editors review, and accepted stories show the circle", async ({ browser }) => {
  test.setTimeout(150_000);
  const ownerContext = await browser.newContext();
  const writerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const writer = await writerContext.newPage();

  await signInWithMagicLink(owner, "en");
  const name = circleName();
  const circleUrl = await createCircle(owner, name);
  const band = owner.getByTestId("circle-band");
  await expect(band).toHaveCSS("background-color", "rgb(29, 78, 216)");
  await expect(band).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await axeSerious(owner)).toEqual([]);

  // No header image: links to the circle preview with a card in its accent color.
  const shareImage = new URL((await owner.locator('meta[property="og:image"]').getAttribute("content"))!);
  expect(shareImage.pathname).toMatch(/^\/api\/og\/circle\/e2e-circle-\d+$/);
  const preview = await owner.request.get(shareImage.pathname + shareImage.search);
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toBe("image/png");

  await signInWithMagicLink(writer, "en");
  const title = `Circle story ${Date.now()}`;
  const storyUrl = await publishStory(writer, title);

  // Submit: waits for review.
  await writer.goto(circleUrl);
  await writer.getByTestId("submit-story").click();
  await writer.getByRole("dialog").getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Submit" }).click();
  await expect(writer.getByText(`Submitted to ${name}. Editors will review it.`)).toBeVisible();
  await expect(writer.getByTestId("circle-stories")).toHaveCount(0);

  // Follow the circle.
  await writer.getByTestId("follow-button").click();
  await expect(writer.getByTestId("circle-followers")).toHaveText("1 follower");

  // The owner is notified and accepts from the queue.
  await owner.goto("/en/me/notifications");
  await expect(owner.getByTestId("notifications-list")).toContainText(`submitted “${title}” to ${name}`);
  await owner.goto(`${circleUrl}/manage`);
  const submission = owner.getByTestId("submission").filter({ hasText: title });
  await submission.getByRole("button", { name: "Accept" }).click();
  await expect(owner.getByRole("heading", { name: "Stories in this circle (1)" })).toBeVisible();
  expect(await axeSerious(owner)).toEqual([]);

  // Adding an unknown username explains the problem.
  await owner.getByLabel("Add someone by username").fill("nobody_by_this_name");
  await owner.getByRole("button", { name: "Add", exact: true }).click();
  await expect(owner.getByRole("main").getByRole("alert")).toHaveText("No one has that username.");

  // The writer hears back, and the story shows its circle.
  await writer.goto("/en/me/notifications");
  await expect(writer.getByTestId("notifications-list")).toContainText(`accepted “${title}” into ${name}`);
  await writer.goto(storyUrl);
  await expect(writer.getByTestId("story-circle")).toHaveText(`Published in ${name}`);
  await writer.goto(circleUrl);
  await expect(writer.getByTestId("circle-stories").getByRole("link", { name: title })).toBeVisible();

  // Search finds the circle.
  await writer.goto(`/en/search?q=${encodeURIComponent(name)}`);
  await expect(writer.getByTestId("search-circles").getByRole("link", { name: new RegExp(name) })).toBeVisible();

  await deleteFromMyStories(writer, title);
  await ownerContext.close();
  await writerContext.close();
});

test("only owners and editors can open the manage page", async ({ browser }) => {
  test.setTimeout(90_000);
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const other = await otherContext.newPage();
  await signInWithMagicLink(owner, "en");
  const circleUrl = await createCircle(owner, circleName());

  await signInWithMagicLink(other, "en");
  await other.goto(`${circleUrl}/manage`);
  await expect(other.getByRole("heading", { level: 1 })).toHaveText("This trail goes cold");
  await other.goto(circleUrl);
  await expect(other.getByTestId("manage-circle")).toHaveCount(0);

  await ownerContext.close();
  await otherContext.close();
});

test("the circles index lists circles with readable accent bands", async ({ page }) => {
  await page.goto("/en/circles");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Circles");
  expect(await axeSerious(page)).toEqual([]);
});

test("private circles: people ask to join, editors let them in, then they publish without review", async ({ browser }) => {
  test.setTimeout(150_000);
  const ownerContext = await browser.newContext();
  const writerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const writer = await writerContext.newPage();

  await signInWithMagicLink(owner, "en");
  const name = circleName();
  const circleUrl = await createCircle(owner, name, { private: true });
  await expect(owner.getByTestId("circle-band").getByTestId("circle-private")).toContainText("Private circle");
  // The owner is a member, so they publish here as usual.
  await expect(owner.getByTestId("submit-story")).toBeVisible();
  await expect(owner.getByTestId("request-to-join")).toHaveCount(0);

  // Still listed for everyone, marked private.
  await writer.goto("/en/circles");
  await expect(writer.getByTestId("circle-list").getByRole("listitem").filter({ hasText: name }).getByTestId("circle-private")).toHaveText("Private");

  await signInWithMagicLink(writer, "en");
  const title = `Private circle story ${Date.now()}`;
  await publishStory(writer, title);
  await writer.goto(circleUrl);
  await expect(writer.getByTestId("submit-story")).toHaveCount(0);
  expect(await axeSerious(writer)).toEqual([]);

  // Ask, take it back, ask again.
  await writer.getByTestId("request-to-join").click();
  await expect(writer.getByTestId("join-pending")).toContainText("Request sent");
  await writer.getByTestId("cancel-join-request").click();
  await expect(writer.getByTestId("request-to-join")).toBeVisible();
  await writer.getByTestId("request-to-join").click();
  await expect(writer.getByTestId("join-pending")).toBeVisible();
  await writer.reload();
  await expect(writer.getByTestId("join-pending")).toBeVisible();

  // The owner hears about it and lets them in from the manage page.
  await owner.goto("/en/me/notifications");
  const notice = owner.getByTestId("notification").filter({ hasText: `asked to join ${name}` });
  await expect(notice).toBeVisible();
  await notice.click();
  await expect(owner).toHaveURL(new RegExp(`${new URL(circleUrl).pathname}/manage$`));
  const request = owner.getByTestId("join-request");
  await expect(request).toHaveCount(1);
  expect(await axeSerious(owner)).toEqual([]);
  await request.getByRole("button", { name: "Accept" }).click();
  await expect(owner.getByTestId("join-requests")).toContainText("No one is waiting to join.");
  await expect(owner.getByTestId("member").filter({ hasText: "Writer" })).toHaveCount(1);

  // Now a writer there: told so, and their story goes straight in.
  await writer.goto("/en/me/notifications");
  await expect(writer.getByTestId("notifications-list")).toContainText(`accepted you into ${name}`);
  await writer.goto(circleUrl);
  await expect(writer.getByTestId("request-to-join")).toHaveCount(0);
  await writer.getByTestId("submit-story").click();
  await writer.getByRole("dialog").getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Submit" }).click();
  await expect(writer.getByText(`Published in ${name}.`)).toBeVisible();

  // Switching back to public from the manage page.
  await owner.goto(`${circleUrl}/manage`);
  await owner.getByRole("radio", { name: /^Public/ }).check();
  await owner.getByTestId("circle-submit").click();
  await expect(owner).toHaveURL(circleUrl);
  await expect(owner.getByTestId("circle-private")).toHaveCount(0);

  await ownerContext.close();
  await writerContext.close();
});
