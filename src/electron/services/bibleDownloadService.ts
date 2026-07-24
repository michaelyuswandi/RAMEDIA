import https from 'https';
import { createHash } from 'crypto';

/**
 * Bible Download Service
 * Handles downloading Bible files from remote server
 */

interface DownloadOptions {
  onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
  timeout?: number;
}

/**
 * Download file from URL
 */
export function downloadFile(
  url: string,
  options: DownloadOptions = {}
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const { onProgress, timeout = 30000 } = options;
    let receivedBytes = 0;
    let totalBytes = 0;
    const chunks: Buffer[] = [];

    const request = https
      .get(url, (response) => {
        // Get total size from header
        const contentLength = response.headers['content-length'];
        totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

        response.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length;
          chunks.push(chunk);

          if (onProgress && totalBytes > 0) {
            onProgress({
              loaded: receivedBytes,
              total: totalBytes,
              percent: (receivedBytes / totalBytes) * 100,
            });
          }
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        });

        response.on('error', (error) => {
          reject(error);
        });
      })
      .on('error', (error) => {
        reject(error);
      });

    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Download with retry logic
 */
export async function downloadFileWithRetry(
  url: string,
  options: DownloadOptions & { maxRetries?: number } = {}
): Promise<ArrayBuffer> {
  const { maxRetries = 3, ...downloadOptions } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Download] Attempt ${attempt + 1}/${maxRetries} from ${url}`);
      const data = await downloadFile(url, downloadOptions);
      console.log('[Download] Success');
      return data;
    } catch (error) {
      console.error(`[Download] Attempt ${attempt + 1} failed:`, error);

      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`[Download] Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error('Download failed after all retries');
}

/**
 * Calculate hash of buffer
 */
export function calculateBufferHash(buffer: ArrayBuffer): string {
  const nodeBuffer = Buffer.from(buffer);
  const hash = createHash('md5').update(nodeBuffer).digest('hex');
  return hash;
}

/**
 * Verify file integrity
 */
export function verifyIntegrity(
  buffer: ArrayBuffer,
  expectedHash: string
): boolean {
  const hash = calculateBufferHash(buffer);
  return hash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Get file size from URL header without downloading
 */
export async function getRemoteFileSize(url: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'HEAD' }, (response: any) => {
      const contentLength = response.headers['content-length'];
      resolve(contentLength ? parseInt(contentLength, 10) : null);
    });

    request.on('error', reject);
    request.end();
  });
}

/**
 * Check if remote file exists
 */
export async function remoteFileExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = https.request(url, { method: 'HEAD' }, (response: any) => {
      resolve(
        response.statusCode === 200 ||
        response.statusCode === 301 ||
        response.statusCode === 302
      );
    });

    request.on('error', () => {
      resolve(false);
    });
    request.end();
  });
}
