import { useKeepAwake } from 'expo-keep-awake';
import Head from 'expo-router/head';
import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/controls';
import { Dialog } from '@/components/dialog';
import { Icon, type IconName } from '@/components/icon';
import { TimerEditor } from '@/components/timer-editor';
import { TimerRow } from '@/components/timer-row';
import { palette } from '@/constants/design';
import { useTimers } from '@/hooks/use-timers';
import type { Timer } from '@/lib/timers';

function StayAwake() { useKeepAwake('active-timers', { suppressDeactivateWarnings: true }); return null; }

function MenuItem({ icon, children, onPress, danger = false }: { icon: IconName; children: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className="min-h-14 flex-row items-center gap-4 px-3 active:bg-white/5"><Icon name={icon} size={20} color={danger ? palette.danger : palette.muted} /><Text className={`font-body text-base ${danger ? 'text-danger' : 'text-cream'}`}>{children}</Text></Pressable>;
}

const subscribeToHydration = () => () => {};

export default function HomeScreen() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? <TimerListScreen /> : <View className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color={palette.orange} /></View>;
}

function TimerListScreen() {
  const app = useTimers();
  const [editor, setEditor] = useState<Timer | 'new' | null>(null);
  const [arranging, setArranging] = useState(false);
  const [menu, setMenu] = useState<Timer | null>(null);
  const [deleting, setDeleting] = useState<Timer | null>(null);
  const [sorting, setSorting] = useState(false);
  const [settings, setSettings] = useState(false);

  return <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
    <Head><title>Timer list</title><meta name="theme-color" content="#28211D" /></Head>
    {app.timers.some(timer => timer.status === 'running') && <StayAwake />}
    <View className="mx-auto w-full max-w-[600px] flex-1">
      <View testID="topbar" className="h-16 flex-row items-center bg-[#211B18] px-2">
        <IconButton icon="menu" label="Menu" onPress={() => setSettings(true)} />
        <Text accessibilityRole="header" className="ml-3 flex-1 font-body text-[23px] text-cream">Timer list</Text>
        {arranging ? <IconButton icon="check" label="Done reordering" onPress={() => setArranging(false)} /> : <>
          <Pressable accessibilityRole="button" accessibilityLabel="Sort timers" onPress={() => setSorting(true)} className="h-11 w-11 items-center justify-center"><Text className="font-body text-[18px] text-muted">AŽ</Text></Pressable>
          <IconButton icon="addTimer" label="Add timer" disabled={!app.ready} onPress={() => setEditor('new')} />
        </>}
      </View>
      {!app.ready ? <View className="flex-1 items-center justify-center"><ActivityIndicator color={palette.orange} accessibilityLabel="Loading timers" /></View> : <ScrollView testID="timer-list" className="min-h-0 flex-1" contentContainerClassName="px-4 pb-4 pt-2" showsVerticalScrollIndicator={false}>
        {app.timers.map((timer, index) => <TimerRow key={timer.id} timer={timer} now={timer.status === 'running' ? app.now : 0} index={index} total={app.timers.length} arranging={arranging} onToggle={() => app.toggle(timer.id)} onEdit={() => setEditor(timer)} onReset={() => app.reset(timer.id)} onMore={() => setMenu(timer)} onMove={direction => app.move(timer.id, direction)} />)}
      </ScrollView>}
      {!!app.notice && <View accessibilityRole="alert" className="flex-row items-center gap-2 bg-raised px-4 py-2"><Text className="flex-1 font-body text-sm text-cream">{app.notice}</Text><IconButton icon="close" label="Dismiss notice" onPress={() => app.setNotice('')} /></View>}
    </View>
    {editor !== null && <TimerEditor timer={editor === 'new' ? undefined : editor} onClose={() => { setEditor(null); app.alarm.stop(); }} onSave={app.save} onPreview={tone => { app.alarm.unlock(); void app.alarm.play(tone); }} />}
    {menu && <Dialog title={menu.label} onClose={() => setMenu(null)}>
      <MenuItem icon="edit" onPress={() => { setEditor(menu); setMenu(null); }}>Edit timer</MenuItem>
      <MenuItem icon="reset" onPress={() => { app.reset(menu.id); setMenu(null); }}>Reset timer</MenuItem>
      <MenuItem icon="copy" onPress={() => { app.duplicate(menu.id); setMenu(null); }}>Duplicate timer</MenuItem>
      <MenuItem icon="grip" onPress={() => { setArranging(true); setMenu(null); }}>Reorder timers</MenuItem>
      <MenuItem icon="trash" danger onPress={() => { setDeleting(menu); setMenu(null); }}>Delete timer</MenuItem>
    </Dialog>}
    {deleting && <Dialog title="Delete timer?" onClose={() => setDeleting(null)}><Text className="mb-4 font-body text-base text-muted">{deleting.label}</Text><View className="flex-row justify-end gap-4"><Pressable accessibilityRole="button" onPress={() => setDeleting(null)} className="min-h-12 justify-center px-3"><Text className="font-body text-cream">CANCEL</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { app.remove(deleting.id); setDeleting(null); }} className="min-h-12 justify-center px-3"><Text className="font-body text-orange">DELETE</Text></Pressable></View></Dialog>}
    {sorting && <Dialog title="Sort" onClose={() => setSorting(false)}><MenuItem icon="sort" onPress={() => { app.sort('label'); setSorting(false); }}>Label · A to Z</MenuItem><MenuItem icon="clock" onPress={() => { app.sort('duration'); setSorting(false); }}>Duration · shortest first</MenuItem><MenuItem icon="grip" onPress={() => { setArranging(true); setSorting(false); }}>Reorder timers</MenuItem></Dialog>}
    {settings && <Dialog title="Menu" onClose={() => setSettings(false)}>
      <MenuItem icon="grip" onPress={() => { setArranging(true); setSettings(false); }}>Reorder timers</MenuItem>
      <MenuItem icon="volume" onPress={() => { app.alarm.unlock(); void app.alarm.play('beep'); }}>Test alarm sound</MenuItem>
      {Platform.OS !== 'web' && <><MenuItem icon="bell" onPress={() => { void app.allowAlarms(); }}>Enable background alarms</MenuItem><MenuItem icon="settings" onPress={() => { void Linking.openSettings(); }}>System settings</MenuItem></>}
    </Dialog>}
  </SafeAreaView>;
}
