import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export interface AiStatus {
  enabled: boolean;
  modelDownloaded: boolean;
  downloading: boolean;
  downloadProgress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  error?: string | null;
}

export interface FormatLyricOptions {
  maxCharsPerLine?: number;
  maxLinesPerSlide?: number;
  autoFixTypos?: boolean;
}

const COMMON_TYPOS: Record<string, string> = {
  tuhn: 'Tuhan',
  thn: 'Tuhan',
  tuahn: 'Tuhan',
  yessu: 'Yesus',
  yesusss: 'Yesus',
  kmu: 'kamu',
  km: 'kamu',
  sy: 'saya',
  slaung: 'selalu',
  slalu: 'selalu',
  slamat: 'selamat',
  smat: 'selamat',
  dgan: 'dengan',
  dgn: 'dengan',
  yg: 'yang',
  utk: 'untuk',
  untk: 'untuk',
  bgi: 'bagi',
  krna: 'karena',
  karna: 'karena',
  trus: 'terus',
  blm: 'belum',
  tdk: 'tidak',
  haleluya: 'Haleluya',
  halleluya: 'Haleluya',
  halleluyah: 'Haleluya',
  aleluya: 'Haleluya',
  hosana: 'Hosana',
  hosanna: 'Hosana',
  amin: 'Amin',
  amen: 'Amen',
  bapa: 'Bapa',
  bapaa: 'Bapa',
  blessin: 'blessing',
  lordd: 'Lord',
  jesuss: 'Jesus',
  praisee: 'praise',
  worshipp: 'worship',
};

function fixWordTypo(word: string): string {
  const cleanWord = word.replace(/[^\w\s-]/g, '');
  const lower = cleanWord.toLowerCase();

  if (COMMON_TYPOS[lower]) {
    const fixed = COMMON_TYPOS[lower];
    if (word === word.toUpperCase() && word.length > 1) {
      return word.replace(cleanWord, fixed.toUpperCase());
    }
    return word.replace(cleanWord, fixed);
  }

  return word;
}

function fixLineTypos(line: string): string {
  return line.split(' ').map(fixWordTypo).join(' ');
}

function splitLongLine(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line];

  const words = line.split(' ');
  const result: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxChars) {
      currentLine += ` ${word}`;
    } else {
      result.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    result.push(currentLine);
  }

  return result;
}

// URL Model GGUF ringan (contoh Qwen2.5-0.5B-Instruct-Q4_K_M ~398MB untuk parsing lirik yang sangat cepat & hemat memori)
const DEFAULT_MODEL_URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';
const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';

class AiService {
  private status: AiStatus = {
    enabled: false,
    modelDownloaded: false,
    downloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    error: null,
  };

  private downloadRequest: http.ClientRequest | null = null;
  private lastNotifyTime = 0;
  private lastNotifyProgress = -1;

  constructor() {
    this.checkModelExists();
  }

  private getModelDirPath(): string {
    const dir = path.join(app.getPath('userData'), 'ai-models');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public getModelFilePath(): string {
    return path.join(this.getModelDirPath(), MODEL_FILENAME);
  }

  public checkModelExists(): boolean {
    const exists = fs.existsSync(this.getModelFilePath());
    this.status.modelDownloaded = exists;
    return exists;
  }

  public getStatus(): AiStatus {
    this.checkModelExists();
    return { ...this.status };
  }

  public async setEnabled(enabled: boolean, window?: BrowserWindow | null): Promise<AiStatus> {
    this.status.enabled = enabled;
    if (enabled && !this.checkModelExists() && !this.status.downloading) {
      // Mulai download jika belum ada
      this.startDownloadModel(window);
    }
    return this.getStatus();
  }

  public startDownloadModel(window?: BrowserWindow | null): void {
    if (this.status.downloading) return;

    const destPath = this.getModelFilePath();
    const tempPath = `${destPath}.tmp`;

    this.status.downloading = true;
    this.status.downloadProgress = 0;
    this.status.downloadedBytes = 0;
    this.status.totalBytes = 0;
    this.status.error = null;
    this.lastNotifyTime = 0;
    this.lastNotifyProgress = -1;

    this.notifyStatus(window);

    const fileStream = fs.createWriteStream(tempPath);

    const makeRequest = (currentUrl: string, redirectCount = 0) => {
      if (redirectCount > 10) {
        this.handleDownloadError(new Error('Too many HTTP redirects'), tempPath, window);
        return;
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(currentUrl);
      } catch (err) {
        this.handleDownloadError(new Error(`Invalid URL: ${currentUrl}`), tempPath, window);
        return;
      }

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) RAMEDIA/1.0',
          'Accept': '*/*',
        },
      };

      this.downloadRequest = client.request(options, (response) => {
        // Handle HTTP Redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
          const redirectUrl = response.headers.location;
          response.resume();
          if (redirectUrl) {
            const nextUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, currentUrl).toString();
            makeRequest(nextUrl, redirectCount + 1);
            return;
          }
        }

        if (response.statusCode !== 200) {
          response.resume();
          this.handleDownloadError(new Error(`HTTP Download failed with status ${response.statusCode}`), tempPath, window);
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        this.status.totalBytes = totalBytes;

        let downloaded = 0;

        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          this.status.downloadedBytes = downloaded;
          if (totalBytes > 0) {
            this.status.downloadProgress = Math.min(99, Math.round((downloaded / totalBytes) * 100));
          }

          const now = Date.now();
          if (this.status.downloadProgress !== this.lastNotifyProgress || now - this.lastNotifyTime > 150) {
            this.lastNotifyTime = now;
            this.lastNotifyProgress = this.status.downloadProgress;
            this.notifyStatus(window);
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => {
            if (fs.existsSync(tempPath)) {
              try {
                fs.renameSync(tempPath, destPath);
              } catch (renameErr) {
                console.error('Failed to rename temp file:', renameErr);
              }
            }
            this.status.downloading = false;
            this.status.modelDownloaded = true;
            this.status.downloadProgress = 100;
            this.notifyStatus(window);
          });
        });

        fileStream.on('error', (err) => {
          this.handleDownloadError(err, tempPath, window);
        });
      });

      this.downloadRequest.on('error', (err: Error) => {
        this.handleDownloadError(err, tempPath, window);
      });

      this.downloadRequest.end();
    };

    makeRequest(DEFAULT_MODEL_URL);
  }

  private handleDownloadError(err: Error, tempPath: string, window?: BrowserWindow | null): void {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    this.status.downloading = false;
    this.status.error = err.message || 'Download failed';
    this.notifyStatus(window);
  }

  public cancelDownload(window?: BrowserWindow | null): void {
    if (this.downloadRequest) {
      this.downloadRequest.destroy();
      this.downloadRequest = null;
    }
    const tempPath = `${this.getModelFilePath()}.tmp`;
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    this.status.downloading = false;
    this.status.error = 'Download cancelled';
    this.notifyStatus(window);
  }

  private notifyStatus(_window?: BrowserWindow | null): void {
    const statusCopy = this.getStatus();
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('ai:status-changed', statusCopy);
      }
    }
  }

  /**
   * Mengatur & memilah teks lirik berantakan menjadi slide terstruktur (Verse, Chorus, Bridge, dll).
   * Mempertahankan struktur section, nomor verse, dan jeda baris (Enter) buatan pengguna.
   */
  public async formatLyric(
    rawLyric: string,
    options?: FormatLyricOptions,
  ): Promise<{ title?: string; slides: Array<{ title: string; content: string }> }> {
    if (!rawLyric || !rawLyric.trim()) {
      return { slides: [] };
    }

    const maxChars = options?.maxCharsPerLine && options.maxCharsPerLine >= 15 ? options.maxCharsPerLine : 40;
    const maxLines = options?.maxLinesPerSlide && options.maxLinesPerSlide >= 1 ? options.maxLinesPerSlide : 4;
    const fixTypos = options?.autoFixTypos !== undefined ? options.autoFixTypos : true;

    // Membagi teks berdasarkan Enter ganda (\n\n+) untuk mempertahankan blok/slide asli pengguna
    const blocks = rawLyric.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
    const slides: Array<{ title: string; content: string }> = [];

    let verseCount = 1;
    let chorusCount = 1;
    let bridgeCount = 1;

    for (const block of blocks) {
      const rawLines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (rawLines.length === 0) continue;

      let sectionTitle: string | null = null;
      let bodyLines = [...rawLines];

      const firstLine = rawLines[0];
      const bracketMatch = firstLine.match(/^\[(.*?)\]$/);
      const headerMatch = firstLine.match(/^(verse|chorus|reff|bridge|intro|outro|bait|refrain|ending|tag)\s*(\d+)?\s*:?$/i);

      if (bracketMatch) {
        // Pengguna sudah membuat header dalam kurung siku, misal [VERSE 2] atau [CHORUS]
        sectionTitle = bracketMatch[1].trim();
        bodyLines = rawLines.slice(1);
      } else if (headerMatch) {
        // Pengguna menulis "Verse 1:" atau "Reff:"
        const typeStr = headerMatch[1].toLowerCase();
        if (typeStr.startsWith('verse') || typeStr.startsWith('bait')) {
          sectionTitle = headerMatch[2] ? `Verse ${headerMatch[2]}` : `Verse ${verseCount++}`;
        } else if (typeStr.startsWith('chorus') || typeStr.startsWith('reff') || typeStr.startsWith('refrain')) {
          sectionTitle = headerMatch[2] ? `Chorus ${headerMatch[2]}` : `Chorus ${chorusCount++}`;
        } else if (typeStr.startsWith('bridge')) {
          sectionTitle = headerMatch[2] ? `Bridge ${headerMatch[2]}` : `Bridge ${bridgeCount++}`;
        } else if (typeStr.startsWith('intro')) {
          sectionTitle = 'Intro';
        } else if (typeStr.startsWith('outro') || typeStr.startsWith('ending')) {
          sectionTitle = 'Outro';
        } else {
          sectionTitle = firstLine;
        }
        bodyLines = rawLines.slice(1);
      }

      // Jika tidak ada header di blok ini, buatkan header otomatis
      if (!sectionTitle) {
        sectionTitle = `Verse ${verseCount++}`;
      }

      // 1. Rapikan spasi & Perbaiki Typo
      const processedLines: string[] = [];
      for (let line of bodyLines) {
        line = line.replace(/\s+/g, ' ').trim();
        if (fixTypos) {
          line = fixLineTypos(line);
        }

        // 2. Smart Line Splitter (maxCharsPerLine)
        const subLines = splitLongLine(line, maxChars);
        processedLines.push(...subLines);
      }

      // 3. Batasi Jumlah Baris Per Slide (maxLinesPerSlide)
      if (processedLines.length > 0) {
        for (let i = 0; i < processedLines.length; i += maxLines) {
          const chunk = processedLines.slice(i, i + maxLines);
          slides.push({
            title: sectionTitle,
            content: chunk.join('\n'),
          });
        }
      }
    }

    if (slides.length === 0 && rawLyric.trim()) {
      slides.push({
        title: 'Verse 1',
        content: rawLyric.trim(),
      });
    }

    return { slides };
  }
}

export const aiService = new AiService();
