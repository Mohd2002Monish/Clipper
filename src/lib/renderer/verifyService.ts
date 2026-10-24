import fs from 'fs';
import { probeService } from '../services/probeService';
import { logger } from '../logger/logger';
import { VideoProbeData } from '../../shared/types';

export interface VerifyOutputOptions {
  outputPath: string;
  expectedDuration: number;
  expectedWidth: number;
  expectedHeight: number;
  toleranceSeconds?: number;
  jobId: string;
  partIndex: number;
}

export interface VerificationResult {
  isValid: boolean;
  actualDuration: number;
  actualWidth: number;
  actualHeight: number;
  actualSizeBytes: number;
  errors: string[];
  probe: VideoProbeData;
}

export class VerifyService {
  public async verifyOutput(options: VerifyOutputOptions): Promise<VerificationResult> {
    const {
      outputPath,
      expectedDuration,
      expectedWidth,
      expectedHeight,
      toleranceSeconds = 1.0,
      jobId,
      partIndex,
    } = options;

    const errors: string[] = [];

    // 1. File existence & size check
    if (!fs.existsSync(outputPath)) {
      errors.push(`Output file does not exist at ${outputPath}`);
    }

    const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
    const sizeBytes = stat ? stat.size : 0;

    if (sizeBytes === 0) {
      errors.push('Output file is 0 bytes.');
    }

    // 2. Probe output video
    let probe: VideoProbeData;
    try {
      probe = await probeService.probeVideo(outputPath, jobId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`FFprobe validation failed: ${msg}`);
      logger.verify('error', 'VERIFY_PROBE_ERROR', `Verification failed probing ${outputPath}`, jobId, partIndex, {
        outputPath,
        errors,
      });
      throw new Error(`Output verification failed: ${errors.join(', ')}`);
    }

    // 3. Duration check with tolerance
    const durationDiff = Math.abs(probe.duration - expectedDuration);
    // Allow either fixed tolerance (e.g. 1.0s) or 5% of expected duration (whichever is larger)
    const allowedTolerance = Math.max(toleranceSeconds, expectedDuration * 0.05);

    if (durationDiff > allowedTolerance) {
      errors.push(
        `Duration discrepancy: expected ~${expectedDuration}s, actual ${probe.duration}s (difference of ${durationDiff.toFixed(2)}s exceeds allowed tolerance ${allowedTolerance.toFixed(2)}s).`
      );
    }

    // 4. Resolution check
    if (probe.displayWidth !== expectedWidth || probe.displayHeight !== expectedHeight) {
      errors.push(
        `Resolution discrepancy: expected ${expectedWidth}x${expectedHeight}, got ${probe.displayWidth}x${probe.displayHeight}.`
      );
    }

    const isValid = errors.length === 0;

    logger.verify(
      isValid ? 'info' : 'error',
      isValid ? 'VERIFY_PASS' : 'VERIFY_FAIL',
      `Verification ${isValid ? 'PASSED' : 'FAILED'} for part ${partIndex} (${probe.displayWidth}x${probe.displayHeight}, ${probe.duration}s, ${sizeBytes} bytes)`,
      jobId,
      partIndex,
      {
        expected: { duration: expectedDuration, width: expectedWidth, height: expectedHeight },
        actual: { duration: probe.duration, width: probe.displayWidth, height: probe.displayHeight, sizeBytes },
        errors,
      }
    );

    if (!isValid) {
      throw new Error(`Verification failed for part ${partIndex}: ${errors.join('; ')}`);
    }

    return {
      isValid: true,
      actualDuration: probe.duration,
      actualWidth: probe.displayWidth,
      actualHeight: probe.displayHeight,
      actualSizeBytes: sizeBytes,
      errors: [],
      probe,
    };
  }
}

export const verifyService = new VerifyService();
