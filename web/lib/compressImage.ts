import imageCompression from "browser-image-compression";

/**
 * Compress to JPEG via canvas — strips EXIF (GPS, device, timestamp).
 */
export async function compressImageForUpload(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.75,
    // Re-encode always so EXIF from original HEIC/JPEG is not kept
    alwaysKeepResolution: false
  });

  // Ensure a clean JPEG File without original name metadata quirks
  return new File([compressed], `photo-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now()
  });
}
