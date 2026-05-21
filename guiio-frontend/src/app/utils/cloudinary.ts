export function cloudinaryUrl(url: string | null | undefined, width: number): string {
  if (!url) return '';
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return url.slice(0, idx + marker.length) + `f_auto,q_auto,w_${width}/` + url.slice(idx + marker.length);
}
