import { describe, it, expect } from 'vitest';
import { DataMasker } from '../../../../server/src/services/dataMasker.js';

describe('DataMasker', () => {
  describe('constructor', () => {
    it('initializes with no custom masks', () => {
      const m = new DataMasker();
      expect(m.dict.size).toBe(0);
      expect(m.pats.length).toBe(10);
    });

    it('parses custom masks', () => {
      const m = new DataMasker('acme=COMPANY,secret=SECRET');
      expect(m.dict.size).toBe(2);
      expect(m.dict.get('acme')).toBe('COMPANY');
      expect(m.dict.get('secret')).toBe('SECRET');
    });

    it('handles malformed custom mask entries', () => {
      const m = new DataMasker('valid=OK,,=,broken');
      expect(m.dict.get('valid')).toBe('OK');
      // Malformed entries are skipped
      expect(m.dict.size).toBe(1);
    });
  });

  describe('mask — EMAIL pattern', () => {
    it('masks email addresses', () => {
      const m = new DataMasker();
      const result = m.mask('Contact user@example.com');
      expect(result).not.toContain('user@example.com');
      expect(result).toContain('[EMAIL_1]');
    });
  });

  describe('mask — IP pattern', () => {
    it('masks IP addresses', () => {
      const m = new DataMasker();
      const result = m.mask('Server at 192.168.1.100');
      expect(result).toContain('[IP_1]');
      expect(result).not.toContain('192.168.1.100');
    });
  });

  describe('mask — URL pattern', () => {
    it('masks URLs', () => {
      const m = new DataMasker();
      const result = m.mask('Visit https://example.com/api/v1');
      expect(result).toContain('[URL_1]');
      expect(result).not.toContain('https://example.com');
    });
  });

  describe('mask — APIKEY pattern', () => {
    it('masks API keys with common prefixes', () => {
      const m = new DataMasker();
      const result = m.mask('Key: sk-ant-api03-abcdefghij');
      expect(result).toContain('[APIKEY_1]');
    });
  });

  describe('mask — UUID pattern', () => {
    it('masks UUIDs', () => {
      const m = new DataMasker();
      const result = m.mask('ID: 550e8400-e29b-41d4-a716-446655440000');
      expect(result).toContain('[UUID_1]');
    });
  });

  describe('mask — DBCONN pattern', () => {
    it('masks database connection strings', () => {
      const m = new DataMasker();
      const result = m.mask('Connect to postgres://user:pass@host:5432/db');
      expect(result).toContain('[DBCONN_1]');
    });
  });

  describe('mask — PATH pattern', () => {
    it('masks file paths with 3+ segments', () => {
      const m = new DataMasker();
      const result = m.mask('File at /home/user/documents/file.txt');
      expect(result).toContain('[PATH_1]');
    });
  });

  describe('mask — PHONE pattern', () => {
    it('masks US phone numbers', () => {
      const m = new DataMasker();
      const result = m.mask('Call 555-123-4567');
      expect(result).toContain('[PHONE_1]');
    });
  });

  describe('mask — SSN pattern', () => {
    it('masks SSNs', () => {
      const m = new DataMasker();
      const result = m.mask('SSN: 123-45-6789');
      expect(result).toContain('[SSN_1]');
    });
  });

  describe('mask — ARN pattern', () => {
    it('masks AWS ARNs', () => {
      const m = new DataMasker();
      const result = m.mask('Resource arn:aws:s3:::my-bucket');
      expect(result).toContain('[ARN_1]');
    });
  });

  describe('mask — custom masks first', () => {
    it('applies custom masks before regex patterns', () => {
      const m = new DataMasker('myapp=APP_NAME');
      const result = m.mask('Deploy myapp to production');
      expect(result).toContain('[APP_NAME]');
      expect(result).not.toContain('myapp');
    });
  });

  describe('mask — dedup same value', () => {
    it('reuses placeholder for repeated values', () => {
      const m = new DataMasker();
      const result = m.mask('user@test.com and user@test.com again');
      const count = (result.match(/\[EMAIL_1\]/g) || []).length;
      expect(count).toBe(2);
      expect(m.map.size).toBe(1);
    });
  });

  describe('mask — no re-masking placeholders', () => {
    it('does not re-mask already masked placeholders', () => {
      const m = new DataMasker();
      const result = m.mask('Already masked [EMAIL_1] stays intact');
      expect(result).toContain('[EMAIL_1]');
    });
  });

  describe('mask — multiple types mixed', () => {
    it('masks email, IP, and URL in the same text', () => {
      const m = new DataMasker();
      const result = m.mask('Email user@test.com from 10.0.0.1 at https://api.example.com');
      expect(result).toContain('[EMAIL_1]');
      expect(result).toContain('[IP_1]');
      expect(result).toContain('[URL_1]');
    });
  });

  describe('mask — empty/falsy input', () => {
    it('returns empty string for empty input', () => {
      const m = new DataMasker();
      expect(m.mask('')).toBe('');
    });
  });

  describe('unmask', () => {
    it('round-trip fidelity', () => {
      const m = new DataMasker();
      const original = 'Email user@test.com from 10.0.0.1';
      const masked = m.mask(original);
      const unmasked = m.unmask(masked);
      expect(unmasked).toBe(original);
    });

    it('passes through text with no placeholders', () => {
      const m = new DataMasker();
      expect(m.unmask('no placeholders here')).toBe('no placeholders here');
    });

    it('returns empty string for empty input', () => {
      const m = new DataMasker();
      expect(m.unmask('')).toBe('');
    });
  });

  describe('report', () => {
    it('returns empty array when nothing masked', () => {
      const m = new DataMasker();
      m.mask('no sensitive data');
      expect(m.report()).toEqual([]);
    });

    it('truncates originals to 3 chars + ***', () => {
      const m = new DataMasker();
      m.mask('user@example.com');
      const r = m.report();
      expect(r.length).toBe(1);
      expect(r[0].original).toBe('use***');
      expect(r[0].placeholder).toBe('[EMAIL_1]');
    });

    it('reports all masked items', () => {
      const m = new DataMasker();
      m.mask('user@test.com and admin@test.com');
      const r = m.report();
      expect(r.length).toBe(2);
    });
  });
});
