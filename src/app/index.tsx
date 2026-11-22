import { useKeepAwake } from 'expo-keep-awake';
import Head from 'expo-router/head';
import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/controls';
import { Dialog } from '@/components/dialog';
import { Icon, type IconName } from '@/components/icon';
import { TimerEditor } from '@/components/timer-editor';
import { TimerRow } from '@/components/timer-row';
import { palette } from '@/constants/design';
import { useTimers } from '@/hooks/use-timers';
import { canReset, type Timer } from '@/lib/timers';

function StayAwake() { useKeepAwake('active-timers', { suppressDeactivateWarnings: true }); return null; }

function MenuItem({ icon, children, onPress, danger = false }: { icon: IconName; children: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} className="-mx-3 min-h-14 flex-row items-center gap-4 rounded-xl px-3 hover:bg-white/5 active:bg-white/10 web:transition-colors"><Icon name={icon} size={20} color={danger ? palette.danger : palette.muted} /><Text className={`font-body text-base ${danger ? 'text-danger' : 'text-cream'}`}>{children}</Text></Pressable>;
}

const subscribeToHydration = () => () => {};

export default function HomeScreen() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? <TimerListScreen /> : <View className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color={palette.orange} /></View>;
}

function TimerListScreen() {
  const app = useTimers();
  const [editor, setEditor] = useState<Timer | 'new' | null>(null);
  const [reordering, setReordering] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Timer | null>(null);
  const [settings, setSettings] = useState(false);
  // Ordering needs at least two timers; every entry point follows this one rule.
  const canOrder = app.ready && app.timers.length > 1;
  const arranging = reordering && canOrder;
  const menu = app.timers.find(timer => timer.id === menuId);
  const finished = app.ringing.some(item => item.cycle === item.timer.repeats);

  return <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
    <Head><title>Timer list</title><meta name="theme-color" content="#28211D" /></Head>
    {app.timers.some(timer => timer.status === 'running') && <StayAwake />}
    <View className="mx-auto w-full max-w-[600px] flex-1">
      <View testID="topbar" className="h-16 flex-row items-center px-2">
        <IconButton icon="menu" label="Menu" onPress={() => setSettings(true)} />
        <Text accessibilityRole="header" className="ml-2 flex-1 font-medium text-[22px] text-cream">{arranging ? 'Reorder' : 'Timer list'}</Text>
        {arranging ? <IconButton icon="check" label="Done reordering" color={palette.text} onPress={() => setReordering(false)} /> : <>
          <IconButton icon="plus" label="Add timer" color={palette.text} disabled={!app.ready || !app.storageSafe} onPress={() => setEditor('new')} />
        </>}
      </View>
      {!app.ready ? <View className="flex-1" /> : app.timers.length === 0 ? <View className="flex-1 items-center justify-center gap-5 px-8">
        {app.storageSafe ? <><Text className="font-body text-base text-muted">No timers yet</Text><Button icon="plus" secondary onPress={() => setEditor('new')}>New timer</Button></>
          : <Text accessibilityRole="alert" className="max-w-[300px] text-center font-body text-base leading-6 text-muted">{app.notice}</Text>}
      </View> : <ScrollView testID="timer-list" className="min-h-0 flex-1" contentContainerClassName="px-4 pb-4 pt-2" showsVerticalScrollIndicator={false}>
        {app.timers.map((timer, index) => <TimerRow key={timer.id} timer={timer} now={timer.status === 'running' ? app.now : 0} index={index} total={app.timers.length} arranging={arranging} onToggle={() => app.toggle(timer.id)} onEdit={() => setEditor(timer)} onReset={() => app.reset(timer.id)} onMore={() => setMenuId(timer.id)} onMove={direction => app.move(timer.id, direction)} />)}
      </ScrollView>}
      {!!app.notice && app.storageSafe && <View accessibilityRole="alert" className="flex-row items-center gap-2 bg-raised py-3 pl-4 pr-2"><Text className="flex-1 font-body text-sm leading-5 text-cream">{app.notice}</Text><IconButton icon="close" label="Dismiss notice" onPress={() => app.setNotice('')} /></View>}
    </View>
    {editor !== null && <TimerEditor timer={editor === 'new' ? undefined : editor} onClose={() => { setEditor(null); app.alarm.stop(); }} onSave={app.save} onPreview={tone => { app.alarm.unlock(); void app.alarm.play(tone); }} />}
    {menu && <Dialog title={menu.label} onClose={() => setMenuId(null)}>
      <MenuItem icon="edit" onPress={() => { setEditor(menu); setMenuId(null); }}>Edit timer</MenuItem>
      {canReset(menu, app.now) && <MenuItem icon="reset" onPress={() => { app.reset(menu.id); setMenuId(null); }}>Reset timer</MenuItem>}
      <MenuItem icon="copy" onPress={() => { app.duplicate(menu.id); setMenuId(null); }}>Duplicate timer</MenuItem>
      {canOrder && <MenuItem icon="grip" onPress={() => { setReordering(true); setMenuId(null); }}>Reorder timers</MenuItem>}
      <MenuItem icon="trash" danger onPress={() => { setDeleting(menu); setMenuId(null); }}>Delete timer</MenuItem>
    </Dialog>}
    {deleting && <Dialog title="Delete timer?" onClose={() => setDeleting(null)}><Text className="mb-6 font-body text-base text-muted">“{deleting.label}” will be deleted.</Text><View className="-mr-3 flex-row justify-end gap-2"><Pressable accessibilityRole="button" onPress={() => setDeleting(null)} className="min-h-12 justify-center rounded-xl px-3 hover:bg-white/5 active:bg-white/10 web:transition-colors"><Text className="font-medium text-base text-cream">Cancel</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { app.remove(deleting.id); setDeleting(null); }} className="min-h-12 justify-center rounded-xl px-3 hover:bg-white/5 active:bg-white/10 web:transition-colors"><Text className="font-medium text-base text-danger">Delete</Text></Pressable></View></Dialog>}
    {settings && <Dialog title="Menu" onClose={() => setSettings(false)}>
      {canOrder && <MenuItem icon="grip" onPress={() => { setReordering(true); setSettings(false); }}>Reorder timers</MenuItem>}
      <MenuItem icon="volume" onPress={() => { app.alarm.unlock(); void app.alarm.play('beep'); }}>Test alarm sound</MenuItem>
      {Platform.OS !== 'web' && <>{!app.permissionReady && <MenuItem icon="bell" onPress={() => { void app.allowAlarms(); }}>Enable background alarms</MenuItem>}<MenuItem icon="settings" onPress={() => { void Linking.openSettings(); }}>System settings</MenuItem></>}
    </Dialog>}
    {app.ringing.length > 0 && <Dialog title={finished ? 'Timer finished' : 'Round complete'} onClose={() => app.ringing.forEach(item => app.dismiss(item.timer.id))}>
      {app.ringing.map((item, index) => <View key={item.timer.id} className={`gap-2 ${index ? 'mt-6' : ''}`}>
        <Text className="font-medium text-2xl text-cream">{item.timer.label}</Text>
        {item.timer.repeats > 1 && <Text className="font-body text-sm text-muted">Round {item.cycle} of {item.timer.repeats}{item.cycle < item.timer.repeats ? ' · the next round has started' : ''}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel={`Stop alarm for ${item.timer.label}`} onPress={() => app.dismiss(item.timer.id)} className="mt-2 min-h-12 items-center justify-center rounded-full bg-orange px-6 hover:opacity-90 active:opacity-70 web:transition-opacity"><Text className="font-medium text-base text-ink">Stop alarm</Text></Pressable>
      </View>)}
    </Dialog>}
  </SafeAreaView>;
}
