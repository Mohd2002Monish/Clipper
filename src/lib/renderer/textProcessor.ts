export interface TokenContext {
  partIndex: number;
  totalParts: number;
  originalFilename: string;
}

/**
 * Replaces tokens {part}, {total}, {title}, {part_nn}, {total_nn} in text strings
 */
export function evaluateTextTokens(rawText: string, context: TokenContext): string {
  if (!rawText) return '';

  const { partIndex, totalParts, originalFilename } = context;
  const baseFilename = (originalFilename || 'Video').split(/[/\\]/).pop() || 'Video';
  const cleanName = baseFilename.replace(/\.[^/.]+$/, '');
  const cleanTitle = cleanName
    .replace(/[/\\?%*:|"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Video';

  const part2Digits = String(partIndex).padStart(2, '0');
  const total2Digits = String(totalParts).padStart(2, '0');

  let result = rawText;
  result = result.replace(/\{title\}/gi, cleanTitle);
  result = result.replace(/\{part\}/gi, String(partIndex));
  result = result.replace(/\{total\}/gi, String(totalParts));
  result = result.replace(/\{part_nn\}/gi, part2Digits);
  result = result.replace(/\{total_nn\}/gi, total2Digits);

  return result;
}

/**
 * Word wraps text based on video width and font size, enforcing max lines
 */
export function wrapTextForOverlay(params: {
  text: string;
  videoWidth: number;
  fontSize: number;
  maxLines: number;
}): { wrappedText: string; isTruncated: boolean } {
  const { text, videoWidth, fontSize, maxLines } = params;
  if (!text) return { wrappedText: '', isTruncated: false };

  // Approximate character capacity per line:
  // Average Latin/Devanagari char width is ~0.55 * fontSize
  const charWidth = fontSize * 0.55;
  const maxCharsPerLine = Math.max(15, Math.floor((videoWidth * 0.85) / charWidth));

  // Split into pre-existing lines first
  const inputLines = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const rawLine of inputLines) {
    if (rawLine.length <= maxCharsPerLine) {
      lines.push(rawLine);
    } else {
      // Word wrap
      const words = rawLine.split(' ');
      let currentLine = '';

      for (const word of words) {
        if (!currentLine) {
          currentLine = word;
        } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
  }

  let isTruncated = false;
  let finalLines = lines;

  if (lines.length > maxLines) {
    finalLines = lines.slice(0, maxLines);
    finalLines[maxLines - 1] = finalLines[maxLines - 1] + '...';
    isTruncated = true;
  }

  return {
    wrappedText: finalLines.join('\n'),
    isTruncated,
  };
}
