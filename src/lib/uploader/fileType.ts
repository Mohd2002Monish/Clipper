import fs from 'fs';

export interface FileValidationResult {
  isValid: boolean;
  detectedFormat?: string;
  error?: string;
}

export function validateVideoFileSignature(filePath: string): FileValidationResult {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return {
        isValid: false,
        error: 'Uploaded file is 0 bytes (empty file).',
      };
    }

    if (stat.size < 64) {
      return {
        isValid: false,
        error: 'File is truncated or too small to be a valid video container.',
      };
    }

    const buffer = Buffer.alloc(64);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 64, 0);
    fs.closeSync(fd);

    // 1. EBML header for WebM / Matroska (MKV) -> 1A 45 DF A3
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return {
        isValid: true,
        detectedFormat: 'matroska/webm',
      };
    }

    // 2. MP4 / MOV / M4V container -> "ftyp" box usually at offset 4 to 8
    const ftypCheck = buffer.subarray(4, 8).toString('ascii');
    if (ftypCheck === 'ftyp') {
      const brand = buffer.subarray(8, 12).toString('ascii').trim();
      return {
        isValid: true,
        detectedFormat: `mp4/mov (${brand})`,
      };
    }

    // Some QuickTime / MOV files start with 'moov' or 'mdat' or 'wide'
    const boxType = buffer.subarray(4, 8).toString('ascii');
    if (['moov', 'mdat', 'wide', 'free', 'skip'].includes(boxType)) {
      return {
        isValid: true,
        detectedFormat: `quicktime (${boxType})`,
      };
    }

    // 3. AVI container -> "RIFF" at 0..4 and "AVI " at 8..12
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'AVI ') {
      return {
        isValid: true,
        detectedFormat: 'avi',
      };
    }

    // Check if the file is plain text (e.g. someone uploaded a .txt renamed to .mp4)
    const isAsciiText = buffer.every((byte) => (byte >= 32 && byte <= 126) || byte === 10 || byte === 13);
    if (isAsciiText) {
      return {
        isValid: false,
        error: 'File appears to be plain text disguised with a video extension.',
      };
    }

    // If uncertain, let FFprobe perform the definitive container inspection
    return {
      isValid: true,
      detectedFormat: 'unknown_binary_container',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      error: `Failed to inspect file header: ${errorMsg}`,
    };
  }
}
