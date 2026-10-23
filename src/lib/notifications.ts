import type { Timer } from './timers';

// Metro selects notifications.native.ts on Android/iOS; web has no native modules.
export async function requestAlarmPermission() { return true; }
export async function syncAlarms(_timers: Timer[]) { return; }
