import type { Timer } from './timers';

export type TimerAlarm = {
  identifier: string;
  date: number;
  cycle: number;
  timer: Pick<Timer, 'id' | 'label' | 'tone' | 'sound' | 'vibrate' | 'repeats'>;
};

export function alarmPlan(timers: Timer[], now: number) {
  return timers.flatMap(timer => {
    if (timer.status !== 'running' || timer.deadline === null) return [];
    const deadline = timer.deadline;
    return Array.from({ length: timer.repeats - timer.completed }, (_, offset) => {
      const date = deadline + offset * timer.duration * 1000;
      const cycle = timer.completed + offset + 1;
      return { identifier: `timerlist:${timer.id}:${date}:${cycle}`, timer, date, cycle };
    }).filter(alarm => alarm.date > now);
  }).sort((a, b) => a.date - b.date);
}
