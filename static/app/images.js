// Compression côté client : bord long ≤ 1600 px, JPEG qualité 0,85.
// createImageBitmap applique la rotation EXIF ; la sortie est toujours du JPEG
// (les HEIC d'iPhone ne doivent pas atterrir dans le dépôt).

const MAX_EDGE = 1600;
const QUALITY = 0.85;

export async function compressImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Compression impossible"))),
        "image/jpeg",
        QUALITY
      );
    });
    return blob;
  } finally {
    bitmap.close();
  }
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",", 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
