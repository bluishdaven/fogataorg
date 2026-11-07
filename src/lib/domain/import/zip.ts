/**
 * A small zip reader for export archives (stored and deflated entries, no zip64), built on the
 * platform's DecompressionStream so no library is needed. Entries are read lazily.
 */

export class ImportFileError extends Error {
  constructor(readonly reason: "notZip" | "unsupported" | "tooLarge" | "empty" | "unknownFormat") {
    super(reason);
  }
}

export type ZipEntry = { name: string; size: number; read: () => Promise<Uint8Array> };

const MAX_ENTRY_BYTES = 25 * 1024 * 1024;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new DecompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    chunks.push(next.value);
    length += next.value.length;
    if (length > MAX_ENTRY_BYTES) throw new ImportFileError("tooLarge");
  }
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new ImportFileError("notZip");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new ImportFileError("notZip");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    entries.push({
      name,
      size,
      read: async () => {
        if (size > MAX_ENTRY_BYTES) throw new ImportFileError("tooLarge");
        const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
        const data = bytes.subarray(start, start + compressedSize);
        if (method === 0) return data;
        if (method === 8) return inflateRaw(data);
        throw new ImportFileError("unsupported");
      },
    });
  }
  return entries;
}
