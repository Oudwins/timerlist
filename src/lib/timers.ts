export const colors = [
  { name: 'Red', value: '#F44336' },
  { name: 'Pink', value: '#E91E63' },
  { name: 'Purple', value: '#9C27B0' },
  { name: 'Deep purple', value: '#673AB7' },
  { name: 'Indigo', value: '#3F51B5' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Sky', value: '#03A9F4' },
  { name: 'Cyan', value: '#00BCD4' },
  { name: 'Teal', value: '#009688' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Light green', value: '#8BC34A' },
  { name: 'Lime', value: '#CDDC39' },
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Amber', value: '#FFC107' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Deep orange', value: '#FF5722' },
  { name: 'Brown', value: '#795548' },
  { name: 'Grey', value: '#9E9E9E' },
  { name: 'Blue grey', value: '#607D8B' },
  { name: 'Slate', value: '#455A64' },
];

export const tones = [
  { id: 'beep', name: 'Beep' },
  { id: 'chime', name: 'Chime' },
  { id: 'bell', name: 'Bell' },
] as const;

export type Tone = (typeof tones)[number]['id'];

export type TimerDefinition = {
  label: string;
  duration: number;
  repeats: number;
  color: string;
  tone: Tone;
  sound: boolean;
  vibrate: boolean;
};

export type Timer = TimerDefinition & {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'finished';
  deadline: number | null;
  remaining: number;
  completed: number;
};

export const defaultDefinition: TimerDefinition = {
  label: '', duration: 60, repeats: 1, color: colors[15].value,
  tone: 'beep', sound: true, vibrate: true,
};

export function createTimer(definition: TimerDefinition, id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`): Timer {
  return { ...definition, id, status: 'idle', deadline: null, remaining: definition.duration * 1000, completed: 0 };
}

export function sampleTimers() {
  return [
    { label: 'rest', duration: 90, repeats: 3 },
    { label: 'long rest', duration: 180 },
    { label: 'short rest', duration: 45 },
    { label: 'med', duration: 12 * 60 },
    { label: 'Easy', duration: 30 * 60 },
    { label: 'medium/hard', duration: 45 * 60 },
  ].map((definition, index) => createTimer({ ...defaultDefinition, ...definition }, `sample-${index}`));
}

export function remainingTime(timer: Timer, now: number) {
  return timer.status === 'running' && timer.deadline !== null
    ? Math.max(0, timer.deadline - now)
    : timer.remaining;
}

// Deadlines, rather than interval ticks, are the source of truth. This also
// catches up every elapsed repetition after sleep, backgrounding, or a reload.
export function advanceTimer(timer: Timer, now: number): Timer {
  if (timer.status !== 'running' || timer.deadline === null || now < timer.deadline) return timer;
  const elapsed = 1 + Math.floor((now - timer.deadline) / (timer.duration * 1000));
  const completed = Math.min(timer.repeats, timer.completed + elapsed);
  if (completed === timer.repeats) {
    return { ...timer, completed, status: 'finished', deadline: null, remaining: 0 };
  }
  return { ...timer, completed, deadline: timer.deadline + elapsed * timer.duration * 1000 };
}

export function startTimer(timer: Timer, now: number): Timer {
  if (timer.status === 'running') return timer;
  const resume = timer.status === 'paused';
  return {
    ...timer, status: 'running', completed: resume ? timer.completed : 0,
    remaining: resume ? timer.remaining : timer.duration * 1000,
    deadline: now + (resume ? timer.remaining : timer.duration * 1000),
  };
}

export function pauseTimer(timer: Timer, now: number): Timer {
  const current = advanceTimer(timer, now);
  if (current.status !== 'running') return current;
  return { ...current, status: 'paused', remaining: remainingTime(current, now), deadline: null };
}

export function resetTimer(timer: Timer) {
  return createTimer(timer, timer.id);
}

export function moveTimer(timers: Timer[], id: string, direction: -1 | 1) {
  const index = timers.findIndex(timer => timer.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= timers.length) return timers;
  const next = [...timers];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function formatTime(milliseconds: number) {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours && `${hours}h`, minutes && `${minutes}m`, rest && `${rest}s`].filter(Boolean).join(' ');
}

export function isTimer(value: unknown): value is Timer {
  if (typeof value !== 'object' || value === null) return false;
  return 'id' in value && typeof value.id === 'string'
    && 'label' in value && typeof value.label === 'string' && value.label.trim().length > 0
    && 'duration' in value && typeof value.duration === 'number' && Number.isInteger(value.duration) && value.duration > 0 && value.duration <= 359999
    && 'repeats' in value && typeof value.repeats === 'number' && Number.isInteger(value.repeats) && value.repeats >= 1 && value.repeats <= 99
    && 'color' in value && typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color)
    && 'tone' in value && tones.some(tone => tone.id === value.tone)
    && 'sound' in value && typeof value.sound === 'boolean'
    && 'vibrate' in value && typeof value.vibrate === 'boolean'
    && 'status' in value && ['idle', 'running', 'paused', 'finished'].some(status => status === value.status)
    && 'remaining' in value && typeof value.remaining === 'number' && Number.isFinite(value.remaining) && value.remaining >= 0 && value.remaining <= value.duration * 1000
    && 'completed' in value && typeof value.completed === 'number' && Number.isInteger(value.completed) && value.completed >= 0 && value.completed <= value.repeats
    && 'deadline' in value && (value.status === 'running'
      ? typeof value.deadline === 'number' && Number.isFinite(value.deadline) && value.deadline > 0 && value.completed < value.repeats
      : value.deadline === null);
}
