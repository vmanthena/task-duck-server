import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureLogger, createLogger } from '../../../shared/logger.js';

describe('shared/logger', () => {
  beforeEach(() => {
    // Reset to defaults
    configureLogger({ level: 'info', server: false });
  });

  it('configureLogger sets the log level', () => {
    configureLogger({ level: 'error' });
    const log = createLogger('test');
    const spy = vi.spyOn(console, 'log');
    log.info('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  it('createLogger returns an object with 4 log methods', () => {
    const log = createLogger('test');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it('level filtering works — debug suppressed at info level', () => {
    configureLogger({ level: 'info', server: false });
    const log = createLogger('test');
    const spy = vi.spyOn(console, 'debug');
    log.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  it('info messages are emitted at info level', () => {
    configureLogger({ level: 'info', server: false });
    const log = createLogger('test');
    const spy = vi.spyOn(console, 'log');
    log.info('hello');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe('hello');
  });

  it('server mode writes JSON to stdout', () => {
    configureLogger({ level: 'info', server: true });
    const log = createLogger('mytag');
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    log.info('server msg');
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.tag).toBe('mytag');
    expect(parsed.msg).toBe('server msg');
  });

  it('server mode writes errors to stderr', () => {
    configureLogger({ level: 'error', server: true });
    const log = createLogger('err');
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    log.error('bad thing');
    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(parsed.level).toBe('error');
  });

  it('tag is included in client mode output', () => {
    configureLogger({ level: 'warn', server: false });
    const log = createLogger('component');
    const spy = vi.spyOn(console, 'warn');
    log.warn('warning');
    expect(spy).toHaveBeenCalledTimes(1);
    const firstArg = spy.mock.calls[0][0] as string;
    expect(firstArg).toContain('[component]');
    expect(firstArg).toContain('[WARN]');
  });
});
