import fs from 'fs';
import path from 'path';

import { SUPPORTED_FONTS } from '@/shared/constants';
export { SUPPORTED_FONTS };

/**
 * Searches system font directories for Noto or high-quality font files.
 * Returns absolute path if found, or undefined to let FFmpeg use font name.
 */
export function resolveFontFilePath(fontFamily: string = 'Noto Sans'): string | undefined {
  const commonFontPaths = [
    // Debian / Ubuntu / Docker paths
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    // macOS font paths
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Kohinoor.ttc', // macOS Hindi/Devanagari
  ];

  for (const fp of commonFontPaths) {
    if (fs.existsSync(fp)) {
      return fp;
    }
  }

  return undefined;
}

/**
 * Writes raw text safely to a UTF-8 file.
 * This guarantees quotes, colons, percent signs, and backslashes never break filter graph parsing!
 */
export function writeSafeTextFile(params: {
  workDir: string;
  slot: 'top' | 'bottom';
  partIndex: number;
  text: string;
}): string {
  const { workDir, slot, partIndex, text } = params;
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  const filename = `text_${slot}_part_${String(partIndex).padStart(2, '0')}.txt`;
  const filePath = path.join(workDir, filename);

  // Write with UTF-8 encoding
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
}
