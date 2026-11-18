/** Browser-only: shrink a photo and return base64 JPEG for sending to the API. */
export async function photoToJpegBase64(file: File, maxPx: number, quality: number): Promise<{ data: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    // Older Safari: decode through an <img>.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);
    return img;
  });
  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = Math.min(1, maxPx / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { data: dataUrl.split(',')[1], previewUrl: dataUrl };
}
