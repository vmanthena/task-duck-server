export const $ = (id: string): HTMLElement => document.getElementById(id)!;

export const esc = (s: string): string => {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
};
