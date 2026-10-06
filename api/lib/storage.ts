/** Private single-server storage. Never mount this directory as static content.
 * Production requires a persistent volume; multi-node deployments need a shared
 * private object store implementation. Backups must respect retention policy. */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export interface FileMeta { key: string; fileName: string; size: number; contentType: string; lastModified: string; }
export function validateStorageKey(key: string) {
  if (!/^(chat|avatar|status)\/u[1-9]\d*\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid storage key');
}
export class Storage {
  private root: string;
  constructor(root = resolve(process.env.MEDIA_STORAGE_DIR || '.data/private-media')) { this.root = root; }
  private path(key: string) { validateStorageKey(key); return resolve(this.root, key); }
  async uploadFile(input: { fileContent: Uint8Array; fileName: string; contentType?: string }) {
    const ownerPath = input.fileName.split('/').slice(0,2).join('/');
    const key = `${ownerPath}/${randomUUID()}`;
    const path = this.path(key);
    if (!input.fileContent.byteLength || input.fileContent.byteLength > MAX_UPLOAD_BYTES) throw new Error('Invalid file size');
    const meta: FileMeta = {key, fileName: input.fileName.split('/').pop() || 'attachment', size: input.fileContent.byteLength, contentType: input.contentType || 'application/octet-stream', lastModified: new Date().toISOString()};
    await mkdir(resolve(path, '..'), { recursive: true, mode: 0o700 });
    await writeFile(path, input.fileContent, { flag: 'wx', mode: 0o600 });
    try { await writeFile(`${path}.json`, JSON.stringify(meta), { flag: 'wx', mode: 0o600 }); }
    catch (err) { await rm(path, { force: true }); throw err; }
    return meta;
  }
  async headFile({fileKey}: {fileKey: string}): Promise<FileMeta> { return JSON.parse(await readFile(`${this.path(fileKey)}.json`, 'utf8')); }
  async readFile({fileKey}: {fileKey: string}) { return readFile(this.path(fileKey)); }
  async deleteFile({fileKey}: {fileKey: string}) {
    const path = this.path(fileKey);
    await rm(path, {force: true}); await rm(`${path}.json`, {force: true}); return true;
  }
  async listFiles(): Promise<{ objects: FileMeta[] }> {
    const objects: FileMeta[] = [];
    let entries: string[];
    try { entries = await readdir(this.root, {recursive: true}); }
    catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { objects }; throw err; }
    for (const entry of entries) if (entry.endsWith('.json')) {
      const key = entry.slice(0,-5);
      objects.push(await this.headFile({fileKey: key}));
    }
    return {objects};
  }
}
export const storage = new Storage();
