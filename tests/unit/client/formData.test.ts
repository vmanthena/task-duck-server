// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { FORM_FIELDS, gatherFormData, setFormData, clearFormData } from '../../../client/src/formData.js';

function createFormFixture() {
  const html = Object.values(FORM_FIELDS)
    .map(id => `<textarea id="${id}"></textarea>`)
    .join('');
  document.body.innerHTML = html;
}

describe('client/formData', () => {
  beforeEach(() => {
    createFormFixture();
  });

  describe('gatherFormData', () => {
    it('reads all form fields', () => {
      (document.getElementById(FORM_FIELDS.taskId) as HTMLTextAreaElement).value = 'TASK-123';
      (document.getElementById(FORM_FIELDS.title) as HTMLTextAreaElement).value = 'My Task';
      const data = gatherFormData();
      expect(data.taskId).toBe('TASK-123');
      expect(data.title).toBe('My Task');
    });

    it('returns empty strings for empty fields', () => {
      const data = gatherFormData();
      expect(data.taskId).toBe('');
      expect(data.raw).toBe('');
    });

    it('reads all 14 fields', () => {
      const data = gatherFormData();
      expect(Object.keys(data).length).toBe(Object.keys(FORM_FIELDS).length);
    });
  });

  describe('setFormData', () => {
    it('sets partial form data', () => {
      setFormData({ taskId: 'SET-1', title: 'Set Title' });
      expect((document.getElementById(FORM_FIELDS.taskId) as HTMLTextAreaElement).value).toBe('SET-1');
      expect((document.getElementById(FORM_FIELDS.title) as HTMLTextAreaElement).value).toBe('Set Title');
    });

    it('does not overwrite unspecified fields', () => {
      (document.getElementById(FORM_FIELDS.raw) as HTMLTextAreaElement).value = 'existing';
      setFormData({ taskId: 'NEW' });
      expect((document.getElementById(FORM_FIELDS.raw) as HTMLTextAreaElement).value).toBe('existing');
    });
  });

  describe('clearFormData', () => {
    it('resets all fields to empty', () => {
      setFormData({ taskId: 'X', title: 'Y', raw: 'Z' });
      clearFormData();
      const data = gatherFormData();
      for (const value of Object.values(data)) {
        expect(value).toBe('');
      }
    });
  });
});
