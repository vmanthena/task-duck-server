import { $ } from './utils.js';
import { playQuack } from './sound.js';

const duckQuotes = [
  "Read the words. Not what you WANT the words to say.",
  "If it's not in the ticket, it's not in the scope.",
  "Your reviewer doesn't want surprises. Neither does your duck.",
  "The best code is the code you didn't write.",
  "Scope creep starts with 'while I'm in here...'",
  "Would a junior dev understand why you touched that file?",
  "Ship the task. Not the task + your weekend project.",
  "The parking lot exists for a reason. Use it.",
  "Are you solving the problem, or redesigning the solution?",
  "YAGNI — You Aren't Gonna Need It. Trust the duck."
];

export function duckSay(msg: string): void {
  $('duckMessage').textContent = msg;
}

export function quackDuck(): void {
  const d = $('duck');
  d.classList.remove('quack');
  void (d as HTMLElement).offsetWidth;
  d.classList.add('quack');
  duckSay(duckQuotes[Math.floor(Math.random() * duckQuotes.length)]);
  playQuack();
}
