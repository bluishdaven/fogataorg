/**
 * Whether an IP address is on the public internet. Imported pictures are fetched by the server, so
 * private, loopback, link-local, carrier-grade NAT, documentation and multicast ranges are refused
 * (no reaching into the hosting network or cloud metadata).
 */
export function isPublicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped?.[1]) return isPublicIPv4(mapped[1]);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return isPublicIPv4(ip);
  if (!ip.includes(":")) return false;
  if (ip === "::" || ip === "::1") return false;
  const first = Number.parseInt(ip.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (ip.startsWith("2001:db8:") || ip.startsWith("2001:0db8:")) return false; // documentation
  return (first & 0xe000) === 0x2000; // global unicast is 2000::/3
}

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}
