import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { syncAlarms, requestAlarmPermission } from '@/lib/notifications';
import { advanceTimer, createTimer, isTimer, moveTimer, pauseTimer, resetTimer, sampleTimers, startTimer, type Timer, type TimerDefinition } from '@/lib/timers';
import { useAlarm } from './use-alarm';

export const storageKey = 'timerlist:timers';

export function useTimers() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const current = useRef(timers);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState('');
  const [storageSafe, setStorageSafe] = useState(true);
  const alarm = useAlarm(setNotice);
  const ring = useRef(alarm.ring);
  const storageQueue = useRef(Promise.resolve());
  const notificationQueue = useRef(Promise.resolve());
  const [permissionReady, setPermissionReady] = useState(false);
  const running = timers.some(timer => timer.status === 'running');

  useEffect(() => { ring.current = alarm.ring; }, [alarm.ring]);

  const commit = useCallback((next: Timer[]) => {
    if (next === current.current) return;
    current.current = next;
    setTimers(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey).then(raw => {
      if (!mounted) return;
      const parsed: unknown = raw === null ? sampleTimers() : JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isTimer) || new Set(parsed.map(timer => timer.id)).size !== parsed.length) {
        throw new Error('Invalid timer data');
      }
      commit(parsed.map(timer => advanceTimer(timer, Date.now())));
    }).catch(() => {
      if (!mounted) return;
      setStorageSafe(false);
      setNotice('Saved timers could not be read. Nothing was overwritten. Reload to retry; new changes will not be saved.');
    }).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, [commit]);

  useEffect(() => {
    if (!ready || !storageSafe) return;
    const snapshot = JSON.stringify(timers);
    storageQueue.current = storageQueue.current.then(() => AsyncStorage.setItem(storageKey, snapshot))
      .catch(() => setNotice('Changes could not be saved. Check that storage is allowed; your next change will retry.'));
  }, [timers, ready, storageSafe]);

  useEffect(() => {
    if (!ready) return;
    // Serialize scheduling and cancellation so rapid start/pause/edit cannot leave stale alarms.
    notificationQueue.current = notificationQueue.current.then(() => syncAlarms(current.current))
      .catch(error => setNotice(error instanceof Error ? error.message : 'Background alarms are unavailable. Keep the app open.'));
  }, [timers, ready, permissionReady]);

  useEffect(() => {
    if (!ready || !running) return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      let changed = false;
      const next = current.current.map(timer => {
        const advanced = advanceTimer(timer, time);
        if (advanced !== timer) {
          changed = true;
          if (Platform.OS === 'web' || AppState.currentState === 'active' || AppState.currentState === null) ring.current(advanced);
        }
        return advanced;
      });
      if (changed) commit(next);
    };
    tick();
    const interval = setInterval(tick, 100);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [ready, running, commit]);

  const allowAlarms = useCallback(async () => {
    try {
      const allowed = await requestAlarmPermission();
      setPermissionReady(allowed);
      if (!allowed) setNotice('Allow notifications and exact alarms in system settings for reliable background alerts. In-app sound still works.');
      return allowed;
    } catch {
      setNotice('Background alarms are unavailable. Keep the app open to hear your timer.');
      return false;
    }
  }, []);

  const prepareStart = () => {
    alarm.unlock();
    if (!permissionReady) void allowAlarms();
  };

  const toggle = (id: string) => {
    const timer = current.current.find(item => item.id === id);
    if (!timer) return;
    if (timer.status !== 'running') prepareStart();
    const time = Date.now();
    setNow(time);
    commit(current.current.map(item => item.id === id ? item.status === 'running' ? pauseTimer(item, time) : startTimer(item, time) : item));
  };

  const save = (definition: TimerDefinition, id?: string) => {
    const timer = createTimer({ ...definition, label: definition.label.trim() }, id);
    commit(id ? current.current.map(item => item.id === id ? timer : item) : [...current.current, timer]);
  };

  return {
    timers, now, ready, notice, setNotice, storageSafe, save, toggle, alarm, allowAlarms,
    reset: (id: string) => commit(current.current.map(timer => timer.id === id ? resetTimer(timer) : timer)),
    remove: (id: string) => commit(current.current.filter(timer => timer.id !== id)),
    duplicate: (id: string) => {
      const timer = current.current.find(item => item.id === id);
      if (timer) commit([...current.current, createTimer({ ...timer, label: `${timer.label} copy` })]);
    },
    move: (id: string, direction: -1 | 1) => commit(moveTimer(current.current, id, direction)),
    sort: (by: 'label' | 'duration') => commit([...current.current].sort((a, b) => by === 'label' ? a.label.localeCompare(b.label) : a.duration - b.duration)),
  };
}
