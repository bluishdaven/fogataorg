import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

type Tree = { [key: string]: string | string[] | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (Array.isArray(value)) value.forEach((item, index) => out.set(`${path}.${index}`, item));
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Top-level ICU argument names, e.g. {name} or {count, plural, …}. */
function args(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i += 1) {
    const char = message[i];
    if (char === "{") {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z0-9_]+)/.exec(message.slice(i));
        if (match?.[1]) names.add(match[1]);
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
  }
  return [...names].sort();
}

const enFlat = flatten(en as unknown as Tree);
const esFlat = flatten(es as unknown as Tree);

describe("messages", () => {
  it("has the same keys in English and Spanish", () => {
    const missingInEs = [...enFlat.keys()].filter((k) => !esFlat.has(k));
    const missingInEn = [...esFlat.keys()].filter((k) => !enFlat.has(k));
    expect({ missingInEs, missingInEn }).toEqual({ missingInEs: [], missingInEn: [] });
  });

  it("uses the same ICU arguments in both languages", () => {
    const mismatches = [...enFlat.entries()]
      .filter(([key, value]) => JSON.stringify(args(value)) !== JSON.stringify(args(esFlat.get(key) ?? "")))
      .map(([key]) => key);
    expect(mismatches).toEqual([]);
  });

  it("has no empty strings", () => {
    const empty = [...enFlat, ...esFlat].filter(([, value]) => value.trim() === "").map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
