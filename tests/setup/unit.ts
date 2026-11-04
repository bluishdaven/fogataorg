import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest doesn't expose globals here, so RTL can't register its own cleanup.
afterEach(() => {
  cleanup();
});
