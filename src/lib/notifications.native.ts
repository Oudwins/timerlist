import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility, AndroidAudioUsage, AndroidAudioContentType } from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { alarmPlan } from './alarm-plan';
import type { Timer } from './timers';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: AppState.currentState !== 'active',
    shouldShowList: AppState.currentState !== 'active',
    shouldPlaySound: AppState.currentState !== 'active',
    shouldSetBadge: false,
  }),
});

function channelId(timer: Pick<Timer, 'tone' | 'sound' | 'vibrate'>) {
  return `timers-${timer.tone}-${timer.sound ? 'sound' : 'silent'}-${timer.vibrate ? 'vibrate' : 'still'}`;
}

async function prepareChannel(timer: Pick<Timer, 'tone' | 'sound' | 'vibrate'>) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId(timer), {
    name: `Timer · ${timer.sound ? timer.tone : 'silent'}${timer.vibrate ? ' · vibration' : ''}`,
    importance: AndroidImportance.MAX,
    audioAttributes: { usage: AndroidAudioUsage.ALARM, contentType: AndroidAudioContentType.SONIFICATION },
    sound: timer.sound ? `${timer.tone}.wav` : null,
    enableVibrate: timer.vibrate,
    vibrationPattern: timer.vibrate ? [0, 300, 150, 300] : [0],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}

export async function requestAlarmPermission() {
  await prepareChannel({ tone: 'beep', sound: true, vibrate: true });
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  if (Platform.OS === 'android') {
    const exact = await Notifications.getExactAlarmPermissionsAsync();
    if (!exact.granted) return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  }
  return true;
}

export async function syncAlarms(timers: Timer[]) {
  const all = alarmPlan(timers, Date.now());
  // iOS only retains 64 pending local notifications across an app.
  const plan = Platform.OS === 'ios' ? all.slice(0, 64) : all;
  const desired = new Set(plan.map(alarm => alarm.identifier));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = new Set(scheduled.map(alarm => alarm.identifier));
  await Promise.all(scheduled.filter(alarm => alarm.identifier.startsWith('timerlist:') && !desired.has(alarm.identifier))
    .map(alarm => Notifications.cancelScheduledNotificationAsync(alarm.identifier)));
  if (!plan.length) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const prepared = new Set<string>();
  for (const alarm of plan) {
    if (existing.has(alarm.identifier)) continue;
    const { timer } = alarm;
    const channel = channelId(timer);
    if (!prepared.has(channel)) { await prepareChannel(timer); prepared.add(channel); }
    // Scheduling is asynchronous: never accidentally deliver an already elapsed alarm.
    if (alarm.date <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: alarm.identifier,
      content: {
        title: `${timer.label} ${alarm.cycle === timer.repeats ? 'finished' : '· next round'}`,
        body: timer.repeats > 1 ? `Round ${alarm.cycle} of ${timer.repeats} complete.` : 'Timer finished.',
        sound: timer.sound ? `${timer.tone}.wav` : false,
        vibrate: timer.vibrate ? [0, 300, 150, 300] : [0],
        color: timer.color,
        data: { timerId: timer.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alarm.date, channelId: channel, delivery: 'alarmClock' },
    });
  }
  if (all.length > plan.length) throw new Error('iOS can queue 64 alarms. Keep the app open for longer repeat sessions.');
}
