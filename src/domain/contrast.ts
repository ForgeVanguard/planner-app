function channel(hex: string, index: number): number {
  const raw = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const r = channel(hex, 0);
  const g = channel(hex, 1);
  const b = channel(hex, 2);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
