export type AllowedImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
};

/** Identify jpeg/png/webp from magic bytes. SVG and spoofed Content-Type are rejected. */
export function sniffImage(buf: Uint8Array): AllowedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  const riff = ascii(buf, 0, 4);
  const webp = ascii(buf, 8, 12);
  if (riff === "RIFF" && webp === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

function ascii(buf: Uint8Array, start: number, end: number) {
  let out = "";
  for (let i = start; i < end && i < buf.length; i++) out += String.fromCharCode(buf[i]);
  return out;
}
