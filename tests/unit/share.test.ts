import { describe, expect, it } from "vitest";
import { SHARE_NETWORKS, shareLink } from "@/lib/domain/share";

const URL_ = "https://fogata.org/@dana/el-río";
const TEXT = "“El río” by Dana on Fogata";

describe("shareLink", () => {
  it("builds one-tap links that carry the story URL, encoded", () => {
    expect(shareLink("whatsapp", URL_, TEXT)).toBe(`https://wa.me/?text=${encodeURIComponent(`${TEXT} ${URL_}`)}`);
    expect(shareLink("x", URL_, TEXT)).toBe(
      `https://x.com/intent/tweet?text=${encodeURIComponent(TEXT)}&url=${encodeURIComponent(URL_)}`,
    );
    expect(shareLink("facebook", URL_, TEXT)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL_)}`);
    expect(shareLink("linkedin", URL_, TEXT)).toContain(`url=${encodeURIComponent(URL_)}`);
    expect(shareLink("telegram", URL_, TEXT)).toContain(`url=${encodeURIComponent(URL_)}&text=`);
    expect(decodeURIComponent(shareLink("email", URL_, TEXT))).toBe(`mailto:?subject=${TEXT}&body=${TEXT}\n\n${URL_}`);
  });

  it("covers every network with a link that names the story", () => {
    for (const network of SHARE_NETWORKS) {
      expect(decodeURIComponent(shareLink(network, URL_, TEXT))).toContain(URL_);
    }
  });
});
