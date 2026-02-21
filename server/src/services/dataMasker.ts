import type { MaskingReport } from '../types.js';

interface Pattern {
  n: string;
  r: RegExp;
}

export class DataMasker {
  map = new Map<string, string>();
  rev = new Map<string, string>();
  ctr: Record<string, number> = {};
  dict = new Map<string, string>();
  pats: Pattern[];

  constructor(cm: string = '') {
    if (cm) {
      cm.split(',').forEach(p => {
        const [k, v] = p.split('=').map(s => s.trim());
        if (k && v) this.dict.set(k.toLowerCase(), v);
      });
    }
    this.pats = [
      { n: 'EMAIL', r: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi },
      { n: 'IP', r: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
      { n: 'URL', r: /https?:\/\/[^\s<>"']+/gi },
      { n: 'APIKEY', r: /\b(?:sk-|ak-|key-|token-)[A-Za-z0-9_-]{10,}\b/gi },
      { n: 'UUID', r: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
      { n: 'DBCONN', r: /(?:mongodb|postgres|mysql|redis|mssql):\/\/[^\s<>"']+/gi },
      { n: 'PATH', r: /(?:\/[a-zA-Z0-9._-]+){3,}/g },
      { n: 'PHONE', r: /\b(?:\+1[-.]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
      { n: 'SSN', r: /\b\d{3}-\d{2}-\d{4}\b/g },
      { n: 'ARN', r: /arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:\S+/gi },
    ];
  }

  private _ph(c: string): string {
    this.ctr[c] = (this.ctr[c] || 0) + 1;
    return `[${c}_${this.ctr[c]}]`;
  }

  mask(t: string): string {
    if (!t) return t;
    let m = t;
    for (const [k, v] of this.dict) {
      const rx = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      m = m.replace(rx, x => {
        const p = `[${v}]`;
        this.map.set(x, p);
        this.rev.set(p, x);
        return p;
      });
    }
    for (const { n, r } of this.pats) {
      m = m.replace(r, x => {
        if (x.startsWith('[') && x.endsWith(']')) return x;
        if (this.map.has(x)) return this.map.get(x)!;
        const p = this._ph(n);
        this.map.set(x, p);
        this.rev.set(p, x);
        return p;
      });
    }
    return m;
  }

  unmask(t: string): string {
    if (!t) return t;
    let u = t;
    for (const [p, o] of this.rev) u = u.replaceAll(p, o);
    return u;
  }

  report(): MaskingReport[] {
    return [...this.map].map(([o, p]) => ({ original: o.substring(0, 3) + '***', placeholder: p }));
  }
}
