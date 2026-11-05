import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { deleteFromMyStories, publishStory } from "./helpers";
import { signInWithMagicLink } from "./sign-in";

async function createCircle(page: Page, name: string): Promise<string> {
  await page.goto("/en/circles");
  await page.getByTestId("start-circle").click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("What it's about").fill("Stories written near water.");
  await page.getByRole("button", { name: "Accent #1d4ed8" }).click();
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
  const name = `E2E circle ${Date.now()}`;
  const circleUrl = await createCircle(owner, name);
  const band = owner.getByTestId("circle-band");
  await expect(band).toHaveCSS("background-color", "rgb(29, 78, 216)");
  await expect(band).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await axeSerious(owner)).toEqual([]);

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
  const circleUrl = await createCircle(owner, `E2E circle ${Date.now()}`);

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
