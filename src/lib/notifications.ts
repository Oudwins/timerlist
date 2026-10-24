import type { Timer } from './timers';
import type { TimerAlarm } from './alarm-plan';

// Metro selects notifications.native.ts on Android/iOS; web has no native modules.
export async function requestAlarmPermission() { return true; }
export async function syncAlarms(_timers: Timer[]) { return; }
export async function presentAlarm(_alarm: TimerAlarm) { return; }
export function getRingingAlarms(): TimerAlarm[] { return []; }
export function subscribeRingingAlarms(_onChange: (alarms: TimerAlarm[]) => void) { return () => {}; }
export async function dismissAlarm(_id: string, _cancelScheduled = false) { return; }
