import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onColor, palette } from '@/constants/design';
import { colors, defaultDefinition, tones, type Timer, type TimerDefinition, type Tone } from '@/lib/timers';
import { IconButton } from './controls';
import { Icon, type IconName } from './icon';

// React Native Web colours the "on" thumb with its own prop, which the native Switch types do not list.
const switchColors = { trackColor: { false: palette.line, true: '#FF572250' }, activeThumbColor: palette.orange };

const tabs: { name: 'Time' | 'Repeat' | 'Color' | 'Tone'; icon: IconName }[] = [
  { name: 'Time', icon: 'clock' }, { name: 'Repeat', icon: 'repeat' }, { name: 'Color', icon: 'palette' }, { name: 'Tone', icon: 'bell' },
];

function NumberField({ label, value, onChange, max, onDragChange }: { label: string; value: string; onChange: (value: string) => void; max: number; onDragChange: (dragging: boolean) => void }) {
  const [focused, setFocused] = useState(false);
  const current = useRef(value);
  useEffect(() => { current.current = value; }, [value]);
  const start = useRef(0);
  const onGrant = useCallback(() => {
    start.current = Number(current.current) || 0;
    Keyboard.dismiss();
    onDragChange(true);
  }, [onDragChange]);
  const onMove = useCallback((_: unknown, { dy }: { dy: number }) => {
    const next = ((start.current + Math.trunc(-dy / 28)) % (max + 1) + max + 1) % (max + 1);
    onChange(String(next).padStart(2, '0'));
  }, [max, onChange]);
  // PanResponder.create registers these callbacks; it does not invoke them during render.
  // eslint-disable-next-line react-hooks/refs
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx),
    onPanResponderGrant: onGrant,
    onPanResponderMove: onMove,
    onPanResponderRelease: () => onDragChange(false),
    onPanResponderTerminate: () => onDragChange(false),
    onPanResponderTerminationRequest: () => false,
  }), [onGrant, onMove, onDragChange]);
  const step = (direction: number) => String((Number(value) + direction + max + 1) % (max + 1)).padStart(2, '0');
  return <View testID={`picker-${label.toLowerCase()}`} className="flex-1 items-center web:touch-none" {...gesture.panHandlers}>
    <Text className="mb-3 font-body text-sm text-muted">{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label.toLowerCase()}`} onPress={() => onChange(step(-1))} className="h-11 w-16 items-center justify-center active:opacity-60"><Text className="font-tabular text-[22px] text-faint">{step(-1)}</Text></Pressable>
    <TextInput accessibilityLabel={label} className={`h-16 w-16 rounded-full border-2 text-center font-tabular text-[25px] text-cream web:outline-none ${focused ? 'border-cream' : 'border-muted/50'}`} onFocus={() => setFocused(true)} keyboardType="number-pad" inputMode="numeric" selectTextOnFocus={Platform.OS !== 'web'} maxLength={2} value={value} onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, 2))} onBlur={() => { setFocused(false); onChange(String(Math.min(max, Number(value) || 0)).padStart(2, '0')); }} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label.toLowerCase()}`} onPress={() => onChange(step(1))} className="h-11 w-16 items-center justify-center active:opacity-60"><Text className="font-tabular text-[22px] text-faint">{step(1)}</Text></Pressable>
  </View>;
}

export function TimerEditor({ timer, onClose, onSave, onPreview }: {
  timer?: Timer; onClose: () => void; onSave: (definition: TimerDefinition, id?: string) => void; onPreview: (tone: Tone) => void;
}) {
  const initial = timer ?? defaultDefinition;
  const [label, setLabel] = useState(initial.label);
  const [hours, setHours] = useState(String(Math.floor(initial.duration / 3600)).padStart(2, '0'));
  const [minutes, setMinutes] = useState(String(Math.floor((initial.duration % 3600) / 60)).padStart(2, '0'));
  const [seconds, setSeconds] = useState(String(initial.duration % 60).padStart(2, '0'));
  const [repeats, setRepeats] = useState(String(initial.repeats));
  const [color, setColor] = useState(initial.color);
  const [tone, setTone] = useState(initial.tone);
  const [sound, setSound] = useState(initial.sound);
  const [vibrate, setVibrate] = useState(initial.vibrate);
  const [tab, setTab] = useState<(typeof tabs)[number]['name']>('Time');
  const [error, setError] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [draggingTime, setDraggingTime] = useState(false);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const ink = onColor(color);
  const duration = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  const count = Math.max(1, Math.min(99, Number(repeats) || 1));

  const save = () => {
    if (!label.trim()) { setError('Enter a timer name.'); nameRef.current?.focus(); return; }
    if (!duration || Number(minutes) > 59 || Number(seconds) > 59) { setError('Set a time above zero.'); setTab('Time'); return; }
    if (!Number.isInteger(Number(repeats)) || Number(repeats) < 1 || Number(repeats) > 99) { setError('Choose 1–99 rounds.'); setTab('Repeat'); return; }
    onSave({ label: label.trim(), duration, repeats: count, color, tone, sound, vibrate }, timer?.id);
    onClose();
  };

  return <Modal transparent animationType={reduceMotion ? 'none' : 'fade'} visible onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 items-center justify-end bg-black/50 sm:justify-center">
      <Pressable accessibilityLabel="Close timer editor" onPress={onClose} className="absolute inset-0" />
      <View accessibilityViewIsModal className="max-h-[94%] w-full max-w-[480px] overflow-hidden rounded-t-[24px] bg-surface sm:rounded-[24px]" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <View className="px-7 pt-9" style={{ backgroundColor: color }}>
          <View className={`mb-6 flex-row items-center gap-2 ${nameFocused ? 'border-b-2 pb-[3px]' : 'border-b pb-1'}`} style={{ borderColor: ink }}>
            <Icon name="tag" size={22} color={ink} />
            <TextInput ref={nameRef} accessibilityLabel="Timer name" autoFocus={!timer && Platform.OS === 'web'} placeholder="Name this timer" placeholderTextColor={ink} onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)} maxLength={60} value={label} onChangeText={text => { setLabel(text); setError(''); }} returnKeyType="done" onSubmitEditing={save} className="min-h-11 flex-1 font-body text-[22px] web:outline-none" style={{ color: ink }} selectionColor={ink} />
          </View>
          <View accessibilityRole="tablist" className="-mx-3 flex-row">
            {tabs.map(item => <Pressable key={item.name} accessibilityRole="tab" aria-selected={tab === item.name} onPress={() => setTab(item.name)} className="flex-1 items-center gap-2 pb-4 pt-3 active:opacity-60" style={{ outlineColor: ink }}>
              <Icon name={item.icon} size={22} color={ink} />
              <Text className={`text-sm ${tab === item.name ? 'font-medium' : 'font-body'}`} style={{ color: ink }}>{item.name}</Text>
              {tab === item.name && <View className="absolute bottom-0 h-[3px] w-8 rounded-t-full" style={{ backgroundColor: ink }} />}
            </Pressable>)}
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" scrollEnabled={!draggingTime} disableScrollViewPanResponder={tab === 'Time'} className="min-h-0 shrink" contentContainerClassName="min-h-[320px] px-7 py-7">
          {tab === 'Time' && <View className="items-center">
            <View className="w-full flex-row items-center gap-1">
              <NumberField label="Hours" value={hours} onChange={setHours} max={99} onDragChange={setDraggingTime} />
              <Text className="pt-6 font-body text-2xl text-muted">:</Text>
              <NumberField label="Minutes" value={minutes} onChange={setMinutes} max={59} onDragChange={setDraggingTime} />
              <Text className="pt-6 font-body text-2xl text-muted">:</Text>
              <NumberField label="Seconds" value={seconds} onChange={setSeconds} max={59} onDragChange={setDraggingTime} />
            </View>
            <IconButton icon="reset" label="Clear time" disabled={!duration} onPress={() => { setHours('00'); setMinutes('00'); setSeconds('00'); }} className="mt-5" />
          </View>}
          {tab === 'Repeat' && <View className="items-center pt-6">
            <Text className="font-body text-base text-muted">Number of rounds</Text>
            <View className="mt-7 flex-row items-center gap-6">
              <IconButton icon="minus" label="Fewer rounds" onPress={() => setRepeats(String(Math.max(1, count - 1)))} disabled={count === 1} />
              <TextInput accessibilityLabel="Number of rounds" keyboardType="number-pad" inputMode="numeric" selectTextOnFocus maxLength={2} value={repeats} onChangeText={text => setRepeats(text.replace(/\D/g, ''))} className="h-20 w-20 rounded-full border border-muted/50 text-center font-body text-[32px] text-cream" />
              <IconButton icon="plus" label="More rounds" onPress={() => setRepeats(String(Math.min(99, count + 1)))} disabled={count === 99} />
            </View>
          </View>}
          {tab === 'Color' && <View className="flex-row flex-wrap justify-between gap-y-4">
            {colors.map(item => <View key={item.value} className="w-1/5 items-center"><Pressable accessibilityRole="radio" accessibilityLabel={item.name} aria-checked={color === item.value} onPress={() => setColor(item.value)} className="h-11 w-11 items-center justify-center rounded-full border-2 active:opacity-70" style={{ backgroundColor: item.value, borderColor: color === item.value ? palette.text : 'transparent' }}>{color === item.value && <Icon name="check" color={onColor(item.value)} size={22} />}</Pressable></View>)}
          </View>}
          {tab === 'Tone' && <View>
            <View className="min-h-12 flex-row items-center gap-3"><Icon name="volume" color={palette.muted} size={20} /><Text className="flex-1 font-body text-base text-cream">Sound</Text><Switch accessibilityLabel="Alarm sound" value={sound} onValueChange={setSound} {...switchColors} thumbColor={sound ? palette.orange : palette.muted} /></View>
            {Platform.OS !== 'web' && <View className="min-h-12 flex-row items-center gap-3"><Icon name="vibrate" color={palette.muted} size={20} /><Text className="flex-1 font-body text-base text-cream">Vibrate</Text><Switch accessibilityLabel="Vibration" value={vibrate} onValueChange={setVibrate} {...switchColors} thumbColor={vibrate ? palette.orange : palette.muted} /></View>}
            <View accessibilityRole="radiogroup" accessibilityLabel="Alarm tone" className="mt-3 border-t border-line pt-3">
              {tones.map(item => <View key={item.id} className="flex-row items-center">
                <Pressable accessibilityRole="radio" accessibilityLabel={item.name} aria-checked={tone === item.id} disabled={!sound} onPress={() => setTone(item.id)} className={`min-h-12 flex-1 flex-row items-center gap-3 active:opacity-60 ${sound ? '' : 'opacity-40'}`}>
                  <View className="w-5">{tone === item.id && <Icon name="check" size={20} color={palette.orange} />}</View>
                  <Text className={`font-body text-base ${tone === item.id ? 'text-cream' : 'text-muted'}`}>{item.name}</Text>
                </Pressable>
                <IconButton icon="play" label={`Preview ${item.name}`} disabled={!sound} onPress={() => onPreview(item.id)} className="-mr-3" />
              </View>)}
            </View>
          </View>}
        </ScrollView>
        <View className="flex-row items-center gap-2 pb-3 pl-7 pr-5">
          <Text accessibilityRole="alert" className="flex-1 font-body text-sm text-danger">{error}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} className="min-h-12 justify-center rounded-xl px-3 hover:bg-white/5 active:bg-white/10 web:transition-colors"><Text className="font-medium text-base text-muted">Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={save} className="min-h-12 min-w-24 items-center justify-center rounded-full bg-orange px-6 hover:opacity-90 active:opacity-70 web:transition-opacity"><Text className="font-medium text-base text-ink">Save</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
