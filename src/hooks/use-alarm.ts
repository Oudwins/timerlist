import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';

import type { Timer, Tone } from '@/lib/timers';

// expo-audio's native players expose looping as an imperative property.
function setLooping(player: AudioPlayer, loop: boolean) { player.loop = loop; }

export function useAlarm(onError: (message: string) => void) {
  const beep = useAudioPlayer(require('../../assets/sounds/beep.wav'));
  const chime = useAudioPlayer(require('../../assets/sounds/chime.wav'));
  const bell = useAudioPlayer(require('../../assets/sounds/bell.wav'));
  const generation = useRef(0);

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

  const stop = useCallback(() => {
    generation.current++;
    beep.pause(); chime.pause(); bell.pause(); Vibration.cancel();
  }, [beep, chime, bell]);

  // useAudioPlayer releases its players on unmount; only cancel our own work.
  useEffect(() => () => { generation.current++; Vibration.cancel(); }, []);

  const play = useCallback(async (tone: Tone, loop = false) => {
    stop();
    const playback = generation.current;
    const player = tone === 'beep' ? beep : tone === 'chime' ? chime : bell;
    try {
      setLooping(player, loop);
      await player.seekTo(0);
      if (generation.current === playback) player.play();
    } catch {
      onError('Could not play the alarm. Check your browser or device sound settings.');
    }
  }, [beep, chime, bell, onError, stop]);

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

  const ring = useCallback((timer: Pick<Timer, 'tone' | 'sound' | 'vibrate'>) => {
    if (timer.sound) void play(timer.tone, true);
    else stop();
    if (timer.vibrate && Platform.OS !== 'web') Vibration.vibrate([0, 300, 150, 300, 1000], true);
  }, [play, stop]);

  return { play, ring, unlock, stop };
}
