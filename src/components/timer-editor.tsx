import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/design';
import { colors, defaultDefinition, tones, type Timer, type TimerDefinition, type Tone } from '@/lib/timers';
import { IconButton } from './controls';
import { Icon, type IconName } from './icon';

const tabs: { name: 'Time' | 'Repeat' | 'Color' | 'Tone'; icon: IconName }[] = [
  { name: 'Time', icon: 'clock' }, { name: 'Repeat', icon: 'repeat' }, { name: 'Color', icon: 'palette' }, { name: 'Tone', icon: 'bell' },
];

function NumberField({ label, value, onChange, max, selected, onDragChange }: { label: string; value: string; onChange: (value: string) => void; max: number; selected?: boolean; onDragChange: (dragging: boolean) => void }) {
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
    <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label.toLowerCase()}`} onPress={() => onChange(step(-1))} className="h-11 justify-center"><Text className="font-body text-[23px] text-faint">{step(-1)}</Text></Pressable>
    <TextInput accessibilityLabel={label} className={`h-16 w-16 rounded-full border-2 text-center font-body text-[25px] text-cream ${selected ? 'border-orange bg-orange' : 'border-muted/50'}`} keyboardType="number-pad" inputMode="numeric" selectTextOnFocus={Platform.OS !== 'web'} maxLength={2} value={value} onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, 2))} onBlur={() => onChange(String(Math.min(max, Number(value) || 0)).padStart(2, '0'))} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label.toLowerCase()}`} onPress={() => onChange(step(1))} className="h-11 justify-center"><Text className="font-body text-[23px] text-faint">{step(1)}</Text></Pressable>
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
  const [showTones, setShowTones] = useState(false);
  const [error, setError] = useState('');
  const [draggingTime, setDraggingTime] = useState(false);
  const insets = useSafeAreaInsets();
  const duration = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  const count = Math.max(1, Math.min(99, Number(repeats) || 1));

  const save = () => {
    if (!label.trim()) { setError('Label required.'); return; }
    if (!duration || Number(minutes) > 59 || Number(seconds) > 59) { setError('Enter a valid time greater than zero.'); setTab('Time'); return; }
    if (!Number.isInteger(Number(repeats)) || Number(repeats) < 1 || Number(repeats) > 99) { setError('Enter 1–99 rounds.'); setTab('Repeat'); return; }
    onSave({ label: label.trim(), duration, repeats: count, color, tone, sound, vibrate }, timer?.id);
    onClose();
  };

  return <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 items-center justify-end bg-black/50 sm:justify-center">
      <Pressable accessibilityLabel="Close timer editor" onPress={onClose} className="absolute inset-0" />
      <View accessibilityViewIsModal className="max-h-[94%] w-full max-w-[480px] overflow-hidden rounded-t-[24px] bg-surface sm:rounded-[24px]" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <View className="px-7 pt-9" style={{ backgroundColor: color }}>
          <View className="mb-6 flex-row items-center gap-2 border-b border-white/60 pb-1">
            <Icon name="tag" size={23} color={palette.text} />
            <TextInput accessibilityLabel="Timer label" autoFocus={!timer && Platform.OS === 'web'} placeholder="Label" placeholderTextColor="#FFFFFF99" maxLength={60} value={label} onChangeText={text => { setLabel(text); setError(''); }} returnKeyType="done" onSubmitEditing={save} className="min-h-11 flex-1 font-body text-[23px] text-white web:outline-none" selectionColor={palette.text} />
          </View>
          <View className="-mx-3 flex-row">
            {tabs.map(item => <Pressable key={item.name} accessibilityRole="tab" aria-selected={tab === item.name} onPress={() => setTab(item.name)} className="flex-1 items-center gap-3 pb-4 pt-3">
              <Icon name={item.icon} size={23} color={palette.text} />
              <Text className="font-medium text-sm text-white">{item.name}</Text>
              {tab === item.name && <View className="absolute bottom-0 h-[3px] w-8 rounded-t-full bg-white" />}
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
              <NumberField label="Seconds" value={seconds} onChange={setSeconds} max={59} selected onDragChange={setDraggingTime} />
            </View>
            <IconButton icon="reset" label="Clear time" color={palette.text} onPress={() => { setHours('00'); setMinutes('00'); setSeconds('00'); }} className="mt-5" />
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
            {colors.map(item => <View key={item.value} className="w-1/5 items-center"><Pressable accessibilityRole="radio" accessibilityLabel={item.name} aria-checked={color === item.value} onPress={() => setColor(item.value)} className="h-11 w-11 items-center justify-center rounded-full border" style={{ backgroundColor: item.value, borderColor: color === item.value ? palette.text : '#FFFFFF40' }}>{color === item.value && <Icon name="check" color={palette.text} size={22} />}</Pressable></View>)}
          </View>}
          {tab === 'Tone' && <View className="items-center gap-4">
            <Text className="font-body text-sm text-muted">Timer alarm</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose alarm tone" onPress={() => setShowTones(!showTones)} className="min-h-12 flex-row items-center gap-4 rounded-full bg-orange px-5"><Icon name="bell" color={palette.text} size={22} /><Text className="font-body text-sm text-white">{tones.find(item => item.id === tone)?.name}</Text><Icon name="down" color={palette.text} size={20} /></Pressable>
            {showTones && <View className="w-full">{tones.map(item => <View key={item.id} className="flex-row items-center"><Pressable accessibilityRole="radio" accessibilityLabel={item.name} aria-checked={tone === item.id} onPress={() => { setTone(item.id); setShowTones(false); }} className="min-h-12 flex-1 flex-row items-center gap-3"><Icon name={tone === item.id ? 'check' : 'bell'} size={18} color={palette.muted} /><Text className="font-body text-sm text-cream">{item.name}</Text></Pressable><IconButton icon="play" label={`Preview ${item.name}`} onPress={() => onPreview(item.id)} /></View>)}</View>}
            <View className="mt-2 flex-row items-center gap-4">
              <Icon name="vibrate" color={palette.text} size={23} /><Switch accessibilityLabel="Vibration" value={vibrate} onValueChange={setVibrate} trackColor={{ false: palette.line, true: '#FF572250' }} thumbColor={vibrate ? palette.orange : palette.muted} />
              <Icon name="volume" color={palette.text} size={23} /><Switch accessibilityLabel="Alarm sound" value={sound} onValueChange={setSound} trackColor={{ false: palette.line, true: '#FF572250' }} thumbColor={sound ? palette.orange : palette.muted} />
            </View>
            <IconButton icon="play" label="Preview alarm sound" color={palette.text} onPress={() => onPreview(tone)} />
          </View>}
        </ScrollView>
        {!!error && <Text accessibilityRole="alert" className="px-7 pb-2 font-body text-sm text-danger">{error}</Text>}
        <View className="flex-row justify-end gap-4 px-6 pb-3">
          <Pressable accessibilityRole="button" onPress={onClose} className="min-h-12 justify-center px-3"><Text className="font-medium text-sm text-cream">CANCEL</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={save} className="min-h-12 min-w-12 items-center justify-center"><Text className="font-medium text-sm text-cream">OK</Text></Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
