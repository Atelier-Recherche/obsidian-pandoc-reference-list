/** MD5 hex pour l’API d’upload Zotero (desktop / Electron). */
export function md5Hex(bytes: Uint8Array): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto') as typeof import('crypto');
    return crypto.createHash('md5').update(Buffer.from(bytes)).digest('hex');
  } catch {
    return '';
  }
}

export function fileMtimeMs(file: { stat: { mtime: number } }): number {
  return Math.round(file.stat.mtime);
}
