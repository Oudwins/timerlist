import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { palette } from '@/constants/design';
import { formatTime, remainingTime, type Timer } from '@/lib/timers';
import { IconButton } from './controls';
import { Icon } from './icon';

export const TimerRow = memo(function TimerRow({ timer, now, index, total, arranging, onToggle, onEdit, onReset, onMore, onMove }: {
  timer: Timer; now: number; index: number; total: number; arranging: boolean;
  onToggle: () => void; onEdit: () => void; onReset: () => void; onMore: () => void; onMove: (direction: -1 | 1) => void;
}) {
  const running = timer.status === 'running';
  const remaining = remainingTime(timer, now);
  const canReset = remaining !== timer.duration * 1000 || timer.completed > 0;
  const circumference = 2 * Math.PI * 32;
  const progress = Math.min(1, remaining / (timer.duration * 1000));
  return <View testID={`timer-${timer.id}`} className="min-h-[104px] flex-row items-center gap-3 py-3">
    <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${timer.label}`} onPress={onMore} className="h-14 w-7 items-center justify-center">
      <Icon name={timer.repeats > 1 ? 'repeat' : 'left'} size={17} color={timer.repeats > 1 ? timer.color : palette.faint} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`${running ? 'Pause' : timer.status === 'finished' ? 'Restart' : timer.status === 'paused' ? 'Resume' : 'Start'} ${timer.label}`} onPress={onToggle} className="h-[72px] w-[72px] items-center justify-center rounded-full active:opacity-70">
      <View className="absolute inset-0"><Svg width={72} height={72} viewBox="0 0 72 72">
        <Circle cx={36} cy={36} r={32} fill="none" stroke={palette.line} strokeWidth={4} />
        {running && <Circle cx={36} cy={36} r={32} fill="none" stroke={timer.color} strokeWidth={4} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} rotation={-90} origin="36, 36" />}
      </Svg></View>
      <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-raised"><Icon name={running ? 'pause' : 'play'} size={25} color={running ? timer.color : palette.muted} /></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${timer.label}`} onPress={onEdit} className="min-w-0 flex-1 justify-center">
      <Text numberOfLines={1} className="font-body text-[19px] leading-7 text-cream">{timer.label}</Text>
      <View className="flex-row items-baseline">
        <Text testID={`countdown-${timer.id}`} className={`font-body ${timer.duration >= 3600 || arranging ? 'text-[24px]' : 'text-[31px]'} max-[359px]:text-[22px] leading-[40px] text-cream`} style={{ fontVariant: ['tabular-nums'] }}>{formatTime(Math.floor(remaining / 1000) * 1000)}</Text>
        {!arranging && <Text className={`font-body text-[20px] text-cream ${timer.duration >= 3600 ? 'max-[359px]:hidden' : 'max-[359px]:text-[14px]'}`} style={{ fontVariant: ['tabular-nums'] }}>.{String(Math.floor(remaining % 1000)).padStart(3, '0')}</Text>}
      </View>
      {timer.repeats > 1 && <Text accessibilityLabel={`Round ${Math.min(timer.completed + 1, timer.repeats)} of ${timer.repeats}`} className="font-body text-xs text-muted">{Math.min(timer.completed + 1, timer.repeats)}/{timer.repeats}</Text>}
    </Pressable>
    {!arranging && <View className="h-11 w-11">{canReset && <IconButton icon="reset" label={`Reset ${timer.label}`} onPress={onReset} />}</View>}
    {arranging && <View><IconButton icon="up" label={`Move ${timer.label} up`} disabled={index === 0} onPress={() => onMove(-1)} /><IconButton icon="down" label={`Move ${timer.label} down`} disabled={index === total - 1} onPress={() => onMove(1)} /></View>}
  </View>;
});
