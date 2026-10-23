import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';
import { Platform, Vibration } from 'react-native';

import type { Timer, Tone } from '@/lib/timers';

export function useAlarm(onError: (message: string) => void) {
  const beep = useAudioPlayer(require('../../assets/sounds/beep.wav'));
  const chime = useAudioPlayer(require('../../assets/sounds/chime.wav'));
  const bell = useAudioPlayer(require('../../assets/sounds/bell.wav'));

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' })
      .catch(() => onError('Audio is unavailable. Check your device sound settings.'));
  }, [onError]);

  useEffect(() => {
    const subscriptions = [beep, chime, bell].map(player => player.addListener('playbackStatusUpdate', status => {
      if (status.error) onError('Could not play the alarm. Allow sound in your browser or device settings.');
    }));
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [beep, chime, bell, onError]);

  const play = useCallback(async (tone: Tone) => {
    const player = tone === 'beep' ? beep : tone === 'chime' ? chime : bell;
    try {
      await player.seekTo(0);
      player.play();
    } catch {
      onError('Could not play the alarm. Check your browser or device sound settings.');
    }
  }, [beep, chime, bell, onError]);

  // A user gesture unlocks each HTML audio element before a later timer callback.
  const unlock = useCallback(() => {
    if (Platform.OS !== 'web') return;
    for (const player of [beep, chime, bell]) {
      player.muted = true;
      player.play();
      player.pause();
      player.muted = false;
    }
  }, [beep, chime, bell]);

  const ring = useCallback((timer: Timer) => {
    if (timer.sound) void play(timer.tone);
    if (timer.vibrate && Platform.OS !== 'web') Vibration.vibrate([0, 300, 150, 300]);
  }, [play]);

  const stop = useCallback(() => {
    beep.pause(); chime.pause(); bell.pause(); Vibration.cancel();
  }, [beep, chime, bell]);

  return { play, ring, unlock, stop };
}
