import { describe, expect, it } from "vitest";
import { circleImageFileName, circleShareUrl, readableCircleUrl, storiesThatFit } from "@/lib/domain/circle-card";

describe("circle share image helpers", () => {
  it("share circles at an unprefixed address and show it without the scheme or language", () => {
    expect(circleShareUrl("https://fogata.org", "Lake-Notes")).toBe("https://fogata.org/circles/lake-notes");
    expect(readableCircleUrl("https://www.fogata.org/es/circles/agua-dulce")).toBe("fogata.org/circles/agua-dulce");
    expect(readableCircleUrl("https://fogata.org/circles/agua")).toBe("fogata.org/circles/agua");
    expect(readableCircleUrl("not a url")).toBe("not a url");
  });

  it("name the file after the circle", () => {
    expect(circleImageFileName("lake-notes")).toBe("fogata-circle-lake-notes.png");
    expect(circleImageFileName("../../etc")).toBe("fogata-circle-etc.png");
    expect(circleImageFileName("")).toBe("fogata-circle-circle.png");
  });

  it("list only as many latest stories as fit, three at most", () => {
    expect(storiesThatFit(1000, 112, 104, 5)).toBe(3);
    expect(storiesThatFit(330, 112, 104, 5)).toBe(2);
    expect(storiesThatFit(150, 112, 104, 5)).toBe(0);
    expect(storiesThatFit(1000, 112, 104, 1)).toBe(1);
    expect(storiesThatFit(-50, 112, 104, 3)).toBe(0);
  });
});
