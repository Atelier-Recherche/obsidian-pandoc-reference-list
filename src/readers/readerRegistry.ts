import type { DocumentAnnotation } from '../annotations/types';

export type ActiveReaderKind = 'pdf' | 'epub' | null;

export interface ActiveReaderState {
  kind: ActiveReaderKind;
  vaultPath: string;
  annotations: DocumentAnnotation[];
  zoteroAttachmentKey?: string;
  citekey?: string;
}

/** Singleton registry for the document currently open in a PandoCit reader */
export class ReaderRegistry {
  private state: ActiveReaderState | null = null;
  private listeners = new Set<() => void>();

  get(): ActiveReaderState | null {
    return this.state;
  }

  set(state: ActiveReaderState | null): void {
    this.state = state;
    this.notify();
  }

  updateAnnotations(annotations: DocumentAnnotation[]): void {
    if (!this.state) return;
    this.state = { ...this.state, annotations };
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const readerRegistry = new ReaderRegistry();
