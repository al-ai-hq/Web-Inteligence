import { readFileSync } from 'node:fs';
import type { ContentPart } from '../providers/types.js';
import type { ScreenshotRef } from '@wpi/core';

export function loadImagesAsContent(
  screenshots: {
    viewport: ScreenshotRef | null;
    full_page: ScreenshotRef | null;
    above_fold: ScreenshotRef | null;
  }
): ContentPart[] {
  const parts: ContentPart[] = [];

  if (screenshots.viewport) {
    const buffer = readFileSync(screenshots.viewport.path);
    const base64 = buffer.toString('base64');
    parts.push({
      type: 'image',
      mimeType: 'image/png',
      data: base64,
    });
  }

  if (screenshots.above_fold) {
    const buffer = readFileSync(screenshots.above_fold.path);
    const base64 = buffer.toString('base64');
    parts.push({
      type: 'image',
      mimeType: 'image/png',
      data: base64,
    });
  }

  if (parts.length === 0 && screenshots.full_page) {
    const buffer = readFileSync(screenshots.full_page.path);
    const base64 = buffer.toString('base64');
    parts.push({
      type: 'image',
      mimeType: 'image/png',
      data: base64,
    });
  }

  return parts;
}
