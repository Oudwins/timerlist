import { memo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { palette } from '@/constants/design';
import { canReset, formatTime, remainingTime, type Timer } from '@/lib/timers';
import { IconButton } from './controls';
import { Icon } from './icon';

export const TimerRow = memo(function TimerRow({ timer, now, index, total, arranging, onToggle, onEdit, onReset, onMore, onMove }: {
  timer: Timer; now: number; index: number; total: number; arranging: boolean;
  onToggle: () => void; onEdit: () => void; onReset: () => void; onMore: () => void; onMove: (direction: -1 | 1) => void;
}) {
  const running = timer.status === 'running';
  const narrow = useWindowDimensions().width < 360;
  const active = running || timer.status === 'paused';
  const remaining = remainingTime(timer, now);
  const resettable = canReset(timer, now);
  const circumference = 2 * Math.PI * 32;
  const progress = Math.min(1, remaining / (timer.duration * 1000));
  const round = Math.min(timer.completed + 1, timer.repeats);
  // A finished timer is back at its full duration, so say why rather than leave it looking idle.
  const state = timer.status === 'finished' ? 'Finished' : timer.status === 'paused' ? 'Paused' : '';
  return <View testID={`timer-${timer.id}`} className="-mx-4 min-h-[104px] flex-row items-center gap-3 px-4 py-3">
    {arranging ? <View className="w-7" /> : <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${timer.label}`} onPress={onMore} className="-mx-2 h-14 w-11 items-center justify-center rounded-xl hover:bg-white/5 active:bg-white/10 web:transition-colors">
      <Icon name="more" size={18} color={palette.faint} />
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel={`${running ? 'Pause' : timer.status === 'finished' ? 'Restart' : timer.status === 'paused' ? 'Resume' : 'Start'} ${timer.label}`} onPress={onToggle} className="h-[72px] w-[72px] items-center justify-center rounded-full hover:opacity-85 active:opacity-70 web:transition-opacity">
      <View className="absolute inset-0"><Svg width={72} height={72} viewBox="0 0 72 72">
        <Circle cx={36} cy={36} r={32} fill="none" stroke={palette.line} strokeWidth={4} />
        {active && <Circle cx={36} cy={36} r={32} fill="none" stroke={timer.color} strokeOpacity={running ? 1 : 0.45} strokeWidth={4} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} rotation={-90} origin="36, 36" />}
      </Svg></View>
      <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-raised"><Icon name={running ? 'pause' : 'play'} size={25} color={running ? timer.color : palette.muted} /></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${timer.label}`} disabled={arranging} onPress={onEdit} className="min-w-0 flex-1 justify-center hover:opacity-80 active:opacity-70 web:transition-opacity">
      <View className="flex-row items-baseline gap-2">
        <Text numberOfLines={1} className="shrink font-body text-[19px] leading-7 text-cream">{timer.label}</Text>
        {!!state && <Text className="font-body text-sm text-muted">{state}</Text>}
        {timer.repeats > 1 && timer.status !== 'finished' && <Text accessibilityLabel={`Round ${round} of ${timer.repeats}`} className="font-body text-sm text-muted">{round}/{timer.repeats}</Text>}
      </View>
      <View className="flex-row items-baseline">
        <Text testID={`countdown-${timer.id}`} className={`font-tabular leading-10 text-cream ${narrow ? 'text-[22px]' : timer.duration >= 3600 || arranging ? 'text-2xl' : 'text-[31px]'}`}>{formatTime(Math.floor(remaining / 1000) * 1000)}</Text>
        {active && !arranging && !(narrow && timer.duration >= 3600) && <Text className={`font-tabular text-muted ${narrow ? 'text-sm' : 'text-xl'}`}>.{Math.floor(remaining % 1000 / 100)}</Text>}
      </View>
    </Pressable>
    {!arranging && <View className="h-11 w-11" />}
    {resettable && !arranging && <Pressable accessibilityRole="button" accessibilityLabel={`Reset ${timer.label}`} onPress={onReset} className="group absolute -right-0.5 top-1/2 h-16 w-16 -translate-y-1/2 items-center justify-center">
      <View className="pointer-events-none h-11 w-11 items-center justify-center rounded-xl group-hover:bg-white/5 group-active:bg-white/10 web:transition-colors"><Icon name="reset" color={palette.muted} size={20} /></View>
    </Pressable>}
    {arranging && <View className="-mr-2"><IconButton icon="up" label={`Move ${timer.label} up`} disabled={index === 0} onPress={() => onMove(-1)} /><IconButton icon="down" label={`Move ${timer.label} down`} disabled={index === total - 1} onPress={() => onMove(1)} /></View>}
  </View>;
});
