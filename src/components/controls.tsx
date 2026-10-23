import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { palette } from '@/constants/design';
import { Icon, type IconName } from './icon';

export function IconButton({ icon, label, onPress, color = palette.muted, disabled = false, className = '' }: {
  icon: IconName; label: string; onPress: () => void; color?: string; disabled?: boolean; className?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} className={`h-11 w-11 items-center justify-center rounded-xl hover:bg-white/5 active:bg-white/10 ${disabled ? 'opacity-25' : ''} ${className}`}><Icon name={icon} color={color} size={20} /></Pressable>;
}

export function Button({ children, onPress, icon, secondary = false, disabled = false, className = '' }: {
  children: ReactNode; onPress: () => void; icon?: IconName; secondary?: boolean; disabled?: boolean; className?: string;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5 hover:opacity-85 active:opacity-70 ${secondary ? 'border border-line bg-raised' : 'bg-orange'} ${disabled ? 'opacity-30' : ''} ${className}`}>
    {icon && <Icon name={icon} size={18} color={secondary ? palette.text : palette.ink} />}
    <Text className={`font-medium text-sm ${secondary ? 'text-cream' : 'text-ink'}`}>{children}</Text>
  </Pressable>;
}
