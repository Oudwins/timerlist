import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { IconButton } from './controls';

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View className="flex-1 items-center justify-center bg-black/65 px-5">
      <Pressable accessibilityLabel="Close dialog" onPress={onClose} className="absolute inset-0" />
      <View accessibilityViewIsModal className="max-h-[90%] w-full max-w-[430px] rounded-3xl border border-line bg-surface p-6">
        <View className="mb-4 flex-row items-center justify-between gap-2"><Text accessibilityRole="header" className="flex-1 font-body text-xl text-cream">{title}</Text><IconButton icon="close" label="Close dialog" onPress={onClose} /></View>
        {children}
      </View>
    </View>
  </Modal>;
}
