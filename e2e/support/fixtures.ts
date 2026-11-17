import { test as base, expect, type Page } from "@playwright/test";
import { getDictionary } from "@mteam/shared";
import { signIn, type TestUser } from "./data.ts";

/** The English copy, so tests find controls by the words a visitor reads without repeating them. */
export const t = getDictionary("en");

/** Console errors we accept, each for a reason outside our code. Keep it short: anything else fails the test. */
const ALLOWED_CONSOLE_ERRORS: RegExp[] = [];

/** The narrowest phone the site supports; the phone project checks every page at this width too. */
const NARROW_WIDTH = 360;

/**
 * What a visitor would see as broken layout: the document wider than the screen, or any visible element reaching past its
 * right edge. Elements inside a container that scrolls sideways on purpose (and itself fits) are fine. The page clips
 * sideways overflow (html, body { overflow-x: clip }), which is why every element is checked and not only the document.
 */
async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const edge = root.clientWidth + 1;
    const problems: string[] = [];
    if (root.scrollWidth > root.clientWidth) problems.push(`document is ${root.scrollWidth}px wide, screen ${root.clientWidth}px`);
    const describe = (element: Element) => {
      const id = element.id ? `#${element.id}` : "";
      const classes = typeof element.className === "string" && element.className ? `.${element.className.trim().split(/\s+/).join(".")}` : "";
      return `${element.tagName.toLowerCase()}${id}${classes}`;
    };
    // A row that scrolls sideways, or a map, which pans its tiles under a frame that clips them.
    const movesSideways = (parent: Element) => /^(auto|scroll)$/.test(getComputedStyle(parent).overflowX) || parent.classList.contains("leaflet-container");
    const scrollsSideways = (element: Element) => {
      for (let parent = element.parentElement; parent && parent !== document.body && parent !== root; parent = parent.parentElement) {
        if (movesSideways(parent)) return parent.getBoundingClientRect().right <= edge;
      }
      return false;
    };
    for (const element of document.body.querySelectorAll("*")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || box.right <= edge) continue;
      if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (scrollsSideways(element)) continue;
      problems.push(`${describe(element)} reaches ${Math.round(box.right)}px on a ${root.clientWidth}px screen`);
    }
    return problems;
  });
}

export interface Checks {
  /** Runs the shared page check: layout at this width (and 360px on the phone project) and a visible main heading. */
  page(heading?: string | RegExp): Promise<void>;
  /** Opens a path and checks the page. */
  visit(path: string, heading?: string | RegExp): Promise<void>;
}

export const test = base.extend<{ errors: string[]; check: Checks; signIn: (options?: Parameters<typeof signIn>[1]) => Promise<TestUser> }>({
  // Every page error and console error on the test's page; the test fails at its end if there are any.
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error" && !ALLOWED_CONSOLE_ERRORS.some((allowed) => allowed.test(message.text()))) {
          errors.push(`console error on ${page.url()}: ${message.text()}`);
        }
      });
      // Map tiles come from OpenStreetMap; a blank tile keeps the tests off the network.
      await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.alloc(0) }));
      await use(errors);
      expect(errors, "page and console errors").toEqual([]);
    },
    { auto: true },
  ],

  check: async ({ page, errors }, use, testInfo) => {
    const checkPage = async (heading?: string | RegExp) => {
      await page.waitForLoadState("load");
      await page.evaluate(() => document.fonts.ready);
      const main = page.getByRole("heading", { level: 1, ...(heading ? { name: heading } : {}) }).first();
      await expect(main, "main heading").toBeVisible();
      // Polled briefly, as a page can still settle after hydration; a real overflow stays.
      await expect.poll(() => layoutProblems(page), { message: `layout at ${page.viewportSize()?.width}px on ${page.url()}`, timeout: 2_000 }).toEqual([]);
      const size = page.viewportSize();
      if (testInfo.project.name === "phone" && size && size.width > NARROW_WIDTH) {
        await page.setViewportSize({ width: NARROW_WIDTH, height: size.height });
        try {
          await expect.poll(() => layoutProblems(page), { message: `layout at ${NARROW_WIDTH}px on ${page.url()}`, timeout: 2_000 }).toEqual([]);
        } finally {
          await page.setViewportSize(size);
        }
      }
      expect(errors, "page and console errors").toEqual([]);
    };
    await use({
      page: checkPage,
      visit: async (path, heading) => {
        const response = await page.goto(path);
        expect(response?.status(), `status of ${path}`).toBeLessThan(400);
        await checkPage(heading);
      },
    });
  },

  signIn: async ({ context }, use) => {
    await use((options) => signIn(context, options));
  },
});

export { expect };
