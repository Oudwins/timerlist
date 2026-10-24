import TimerAlarms from '../../modules/timer-alarms/src/TimerAlarmsModule';
import { alarmPlan, type TimerAlarm } from './alarm-plan';
import type { Timer } from './timers';

export { requestAlarmPermission } from './notifications.native';

export async function syncAlarms(timers: Timer[]) {
  await TimerAlarms.syncAlarms(JSON.stringify(alarmPlan(timers, Date.now())));
}

export function presentAlarm(alarm: TimerAlarm) {
  return TimerAlarms.presentAlarm(JSON.stringify(alarm));
}

export function getRingingAlarms() { return TimerAlarms.getRingingAlarms(); }
export function subscribeRingingAlarms(onChange: (alarms: TimerAlarm[]) => void) {
  const subscription = TimerAlarms.addListener('onChange', event => onChange(event.alarms));
  return () => subscription.remove();
}
export function dismissAlarm(id: string, cancelScheduled = false) { return TimerAlarms.dismissAlarm(id, cancelScheduled); }
