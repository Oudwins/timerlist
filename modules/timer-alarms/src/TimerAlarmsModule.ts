import { NativeModule, requireNativeModule } from 'expo';

import type { TimerAlarm } from '../../../src/lib/alarm-plan';

declare class TimerAlarmsModule extends NativeModule<{ onChange: (event: { alarms: TimerAlarm[] }) => void }> {
  syncAlarms(plan: string): Promise<void>;
  presentAlarm(alarm: string): Promise<void>;
  getRingingAlarms(): TimerAlarm[];
  dismissAlarm(id: string, cancelScheduled: boolean): Promise<void>;
}

export default requireNativeModule<TimerAlarmsModule>('TimerAlarms');
