import Svg, { Circle, Path } from 'react-native-svg';

const paths = {
  plus: 'M12 5v14M5 12h14',
  menu: 'M3 6h18M3 12h18M3 18h18',
  left: 'm14 6-6 6 6 6',
  tag: 'M3 5h11l7 7-7 7H3Zm4 7h.01',
  addTimer: 'M10 13h4m-2-2v4M5 3 2 6m17-3 3 3M9 2h6',
  play: 'm9 5 11 7-11 7Z',
  pause: 'M9 5v14M15 5v14',
  reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
  repeat: 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',
  clock: 'M12 8v4l3 2M9 2h6M12 2v3m6 1 2-2',
  palette: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  sort: 'M4 5h12M4 10h9M4 15h6m9-8v14m-4-4 4 4 4-4',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  volume: 'm11 5-6 4H2v6h3l6 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'm11 5-6 4H2v6h3l6 4Zm5 4 6 6m-6 0 6-6',
  vibrate: 'M8 4h8v16H8ZM4 8v8M1 10v4m19-6v8m3-6v4',
  edit: 'm16 3 5 5M4 15 17 2l5 5L9 20l-6 1Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  copy: 'M9 9h12v12H9ZM15 5V3H3v12h2',
  info: 'M12 11v6M12 7h.01',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  minus: 'M5 12h14',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  leaf: 'M20 3c-9-1-16 3-16 10a7 7 0 0 0 7 7c7 0 10-9 9-17ZM4 20l10-10',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden aria-hidden>
      {(name === 'clock' || name === 'addTimer' || name === 'info') && <Circle cx="12" cy={name === 'info' ? '12' : '13'} r={name === 'info' ? '9' : '8'} />}
      <Path d={paths[name]} fill={name === 'play' ? color : 'none'} strokeWidth={name === 'more' || name === 'grip' ? 3 : 1.6} />
      {name === 'palette' && <><Circle cx="8" cy="9" r=".6" /><Circle cx="12" cy="7" r=".6" /><Circle cx="16" cy="9" r=".6" /><Circle cx="7" cy="13" r=".6" /></>}
    </Svg>
  );
}
