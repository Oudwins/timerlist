import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceTimer, createTimer, defaultDefinition, durationLabel, formatTime, isTimer, moveTimer, pauseTimer, remainingTime, resetTimer, sampleTimers, startTimer } from '../../src/lib/timers.ts';
import { alarmPlan } from '../../src/lib/alarm-plan.ts';

const make = (overrides = {}) => createTimer({ ...defaultDefinition, label: 'Tea', duration: 5, ...overrides }, 'tea');

test('a labelled timer starts with the saved duration', () => {
  const timer = make();
  assert.equal(timer.label, 'Tea');
  assert.equal(timer.remaining, 5000);
  assert.equal(startTimer(timer, 100).deadline, 5100);
});

test('concurrent timers are independent', () => {
  const a = startTimer(make(), 1000);
  const b = startTimer(make({ duration: 10 }), 2000);
  assert.equal(remainingTime(a, 3000), 3000);
  assert.equal(remainingTime(b, 3000), 9000);
});

test('pause and resume preserve the exact remaining time', () => {
  const paused = pauseTimer(startTimer(make(), 1000), 2250);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.remaining, 3750);
  assert.equal(paused.deadline, null);
  const resumed = startTimer(paused, 10000);
  assert.equal(resumed.deadline, 13750);
});

test('pausing at a repeat boundary first advances the round', () => {
  const paused = pauseTimer(startTimer(make({ repeats: 3 }), 1000), 6500);
  assert.equal(paused.completed, 1);
  assert.equal(paused.remaining, 4500);
});

test('repetitions advance without timer drift', () => {
  const started = startTimer(make({ repeats: 3 }), 1000);
  const next = advanceTimer(started, 6300);
  assert.equal(next.completed, 1);
  assert.equal(next.deadline, 11000);
  const done = advanceTimer(next, 16000);
  assert.equal(done.status, 'finished');
  assert.equal(done.completed, 3);
  assert.equal(done.remaining, 5000);
});

test('background catch-up skips every elapsed round, not just one', () => {
  const timer = startTimer(make({ repeats: 10 }), 1000);
  const next = advanceTimer(timer, 37300);
  assert.equal(next.completed, 7);
  assert.equal(next.deadline, 41000);
  assert.equal(advanceTimer(timer, 100000).completed, 10);
});

test('a finished timer restarts with every round available', () => {
  const finished = advanceTimer(startTimer(make({ repeats: 3 }), 1000), 16000);
  const restarted = startTimer(finished, 20000);
  assert.equal(restarted.completed, 0);
  assert.equal(restarted.deadline, 25000);
  assert.equal(restarted.status, 'running');
});

test('completion restores the saved duration and does not restart itself', () => {
  const timer = make();
  const done = advanceTimer(startTimer(timer, 1000), 6000);
  assert.equal(done.remaining, timer.duration * 1000);
  assert.equal(remainingTime(done, 100000), timer.duration * 1000);
  assert.equal(done.deadline, null);
  assert.equal(advanceTimer(done, 100000), done);
  assert.ok(isTimer(done));
  assert.deepEqual(alarmPlan([done], 100000), []);
});

test('reset preserves definition but clears runtime state', () => {
  const timer = resetTimer(startTimer(make({ color: '#65ACED', repeats: 4, tone: 'bell' }), 1000));
  assert.equal(timer.status, 'idle');
  assert.equal(timer.deadline, null);
  assert.equal(timer.color, '#65ACED');
  assert.equal(timer.repeats, 4);
  assert.equal(timer.tone, 'bell');
});

test('reordering preserves every timer and handles boundaries', () => {
  const timers = sampleTimers();
  assert.equal(moveTimer(timers, timers[0].id, -1), timers);
  assert.equal(moveTimer(timers, 'missing', 1), timers);
  const next = moveTimer(timers, timers[0].id, 1);
  assert.equal(next[1].id, timers[0].id);
  assert.equal(next.length, timers.length);
  assert.equal(timers[0].label, 'rest');
});

test('formatting never rounds a running timer to zero early', () => {
  assert.equal(formatTime(1), '00:01');
  assert.equal(formatTime(90000), '01:30');
  assert.equal(formatTime(3600000), '01:00:00');
  assert.equal(formatTime(-1), '00:00');
  assert.equal(durationLabel(3690), '1h 1m 30s');
});

test('invalid persisted values are rejected', () => {
  assert.ok(isTimer(make()));
  assert.ok(sampleTimers().every(isTimer));
  for (const bad of [null, {}, { ...make(), duration: 0 }, { ...make(), duration: Infinity }, { ...make(), repeats: -1 }, { ...make(), repeats: 100 }, { ...make(), label: ' ' }, { ...make(), tone: 'bogus' }, { ...make(), status: 'running', deadline: null }, { ...make(), remaining: -5 }]) assert.equal(isTimer(bad), false);
});

test('all repeat alarms are queued in advance and cancelled by pause/reset/delete', () => {
  const timer = startTimer(make({ repeats: 3 }), 1000);
  const plan = alarmPlan([timer], 1000);
  assert.deepEqual(plan.map(alarm => alarm.date), [6000, 11000, 16000]);
  assert.deepEqual(plan.map(alarm => alarm.cycle), [1, 2, 3]);
  assert.equal(new Set(plan.map(alarm => alarm.identifier)).size, 3);
  assert.equal(alarmPlan([pauseTimer(timer, 2000)], 2000).length, 0);
  assert.equal(alarmPlan([resetTimer(timer)], 2000).length, 0);
  assert.equal(alarmPlan([], 2000).length, 0);
});

test('alarm plans ignore elapsed dates, and resume from a new deadline', () => {
  const timer = startTimer(make({ repeats: 3 }), 1000);
  assert.deepEqual(alarmPlan([timer], 8000).map(alarm => alarm.date), [11000, 16000]);
  const resumed = startTimer(pauseTimer(timer, 3000), 20000);
  assert.deepEqual(alarmPlan([resumed], 20000).map(alarm => alarm.date), [23000, 28000, 33000]);
});
