import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'No browser runtime errors').toEqual([]);
  }, { auto: true }],
});

async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(name), fullPage: true, animations: 'disabled' });
}

async function createTimer(page: Page, label: string, seconds = 5, repeats = 1) {
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Timer label' }).fill(label);
  await page.getByRole('textbox', { name: 'Minutes', exact: true }).fill('00');
  await page.getByRole('textbox', { name: 'Seconds', exact: true }).fill(String(seconds));
  if (repeats > 1) {
    await page.getByRole('tab', { name: 'Repeat', exact: true }).click();
    await page.getByRole('textbox', { name: 'Number of rounds' }).fill(String(repeats));
  }
  await page.getByRole('button', { name: 'OK', exact: true }).click();
}

async function reset(page: Page, label: string) {
  await page.getByRole('button', { name: `Options for ${label}`, exact: true }).click();
  await page.getByRole('button', { name: 'Reset timer', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start rest', exact: true })).toBeVisible();
});

test('screenshot-style list has only a top bar and timers', async ({ page }, info) => {
  await expect(page).toHaveTitle('Timer list');
  await expect(page.getByRole('heading', { name: 'Timer list', exact: true })).toBeVisible();
  await expect(page.getByTestId('countdown-sample-0')).toHaveText('01:30');
  await expect(page.getByTestId('countdown-sample-1')).toHaveText('03:00');
  await expect(page.getByTestId('countdown-sample-2')).toHaveText('00:45');
  await expect(page.getByRole('button', { name: /start all|pause all|stop all/i })).toHaveCount(0);
  await expect(page.getByText(/Your time|on purpose|well-earned|rhythm|Ready when|Saved on this|Make it yours/i)).toHaveCount(0);
  const add = page.getByTestId('topbar').getByRole('button', { name: 'Add timer' });
  const bounds = await add.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(48);
  expect(bounds?.height).toBeLessThanOrEqual(48);
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await capture(page, info, 'timer-list.png');
});

test('create, customize every tab, persist, and edit', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Timer label' }).fill('Coffee');
  await page.getByRole('textbox', { name: 'Minutes', exact: true }).fill('04');
  await page.getByRole('textbox', { name: 'Seconds', exact: true }).fill('30');
  await capture(page, info, 'time-editor.png');
  await page.getByRole('tab', { name: 'Repeat', exact: true }).click();
  await page.getByRole('textbox', { name: 'Number of rounds' }).fill('3');
  await capture(page, info, 'repeat-editor.png');
  await page.getByRole('tab', { name: 'Color', exact: true }).click();
  await page.getByRole('radio', { name: 'Teal', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Teal', exact: true })).toBeChecked();
  await capture(page, info, 'color-editor.png');
  await page.getByRole('tab', { name: 'Tone', exact: true }).click();
  await page.getByRole('button', { name: 'Choose alarm tone' }).click();
  await page.getByRole('radio', { name: 'Chime', exact: true }).click();
  await page.getByRole('switch', { name: 'Vibration', exact: true }).click();
  await capture(page, info, 'tone-editor.png');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Coffee', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Coffee', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Minutes', exact: true })).toHaveValue('04');
  await expect(page.getByRole('textbox', { name: 'Seconds', exact: true })).toHaveValue('30');
  await page.getByRole('tab', { name: 'Repeat', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Number of rounds' })).toHaveValue('3');
  await page.getByRole('tab', { name: 'Color', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Teal', exact: true })).toBeChecked();
  await page.getByRole('tab', { name: 'Tone', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose alarm tone' })).toContainText('Chime');
  await expect(page.getByRole('switch', { name: 'Vibration', exact: true })).not.toBeChecked();
  await page.getByRole('textbox', { name: 'Timer label' }).fill('Tea');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Tea', exact: true })).toBeVisible();
});

test('validates labels and zero durations; cancel does not save', async ({ page }) => {
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Label required.');
  await page.getByRole('textbox', { name: 'Timer label' }).fill('Invalid');
  await page.getByRole('button', { name: 'Clear time', exact: true }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Invalid', exact: true })).toHaveCount(0);
});

test('concurrent timers pause, resume, and reset independently', async ({ page }) => {
  const time = new Date();
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.getByRole('button', { name: 'Start long rest', exact: true }).click();
  await page.clock.fastForward(10000);
  await expect(page.getByTestId('countdown-sample-0')).toHaveText('01:20');
  await expect(page.getByTestId('countdown-sample-1')).toHaveText('02:50');
  await page.getByRole('button', { name: 'Pause rest', exact: true }).click();
  await page.clock.fastForward(5000);
  await expect(page.getByTestId('countdown-sample-0')).toHaveText('01:20');
  await expect(page.getByTestId('countdown-sample-1')).toHaveText('02:45');
  await page.getByRole('button', { name: 'Resume rest', exact: true }).click();
  await reset(page, 'rest');
  await expect(page.getByTestId('countdown-sample-0')).toHaveText('01:30');
  await expect(page.getByRole('button', { name: 'Pause long rest', exact: true })).toBeVisible();
});

test('running timers survive reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Start long rest', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause long rest', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pause long rest', exact: true })).toBeVisible();
});

test('right-side reset stays visible while paused and affects only its timer', async ({ page }, info) => {
  await expect(page.getByRole('button', { name: 'Reset rest', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.getByRole('button', { name: 'Start long rest', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset rest', exact: true })).toBeVisible();
  const resetBounds = await page.getByRole('button', { name: 'Reset rest', exact: true }).boundingBox();
  const labelBounds = await page.getByRole('button', { name: 'Edit rest', exact: true }).boundingBox();
  expect(resetBounds?.x).toBeGreaterThan(labelBounds ? labelBounds.x + labelBounds.width : 0);
  await page.getByRole('button', { name: 'Pause rest', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset rest', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reset rest', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume rest', exact: true }).click();
  await capture(page, info, 'running-reset.png');
  await page.getByRole('button', { name: 'Reset rest', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start rest', exact: true })).toBeVisible();
  await expect(page.getByTestId('countdown-sample-0')).toHaveText('01:30');
  await expect(page.getByRole('button', { name: 'Reset rest', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pause long rest', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start rest', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset long rest', exact: true })).toBeVisible();
});

test('lap counts and timer row geometry stay stable before play, pause, and reset', async ({ page }) => {
  const time = new Date();
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  const row = page.getByTestId('timer-sample-0');
  const label = page.getByRole('button', { name: 'Edit rest', exact: true });
  await expect(row.getByLabel('Round 1 of 3', { exact: true })).toBeVisible();
  const initialRow = await row.boundingBox();
  const initialLabel = await label.boundingBox();
  const initialNextRow = await page.getByTestId('timer-sample-1').boundingBox();
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  await page.clock.fastForward(1000);
  await expect(page.getByRole('button', { name: 'Reset rest', exact: true })).toBeVisible();
  await expect(row.getByLabel('Round 1 of 3', { exact: true })).toBeVisible();
  expect(await row.boundingBox()).toEqual(initialRow);
  expect(await label.boundingBox()).toEqual(initialLabel);
  expect(await page.getByTestId('timer-sample-1').boundingBox()).toEqual(initialNextRow);
  await page.getByRole('button', { name: 'Pause rest', exact: true }).click();
  expect(await label.boundingBox()).toEqual(initialLabel);
  await page.getByRole('button', { name: 'Reset rest', exact: true }).click();
  await expect(row.getByLabel('Round 1 of 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset rest', exact: true })).toHaveCount(0);
  expect(await label.boundingBox()).toEqual(initialLabel);
});

test('reset remains available at later lap boundaries and after finishing', async ({ page }) => {
  const time = new Date();
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await createTimer(page, 'Laps', 2, 2);
  const label = page.getByRole('button', { name: 'Edit Laps', exact: true });
  await expect(label.getByLabel('Round 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Laps', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Laps', exact: true }).click();
  // Nothing to reset before any time or laps have elapsed.
  await page.getByRole('button', { name: 'Pause Laps', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset Laps', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume Laps', exact: true }).click();
  await page.clock.fastForward(2000);
  await expect(label).toContainText('00:02');
  await expect(label.getByLabel('Round 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause Laps', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset Laps', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume Laps', exact: true }).click();
  await page.clock.fastForward(2000);
  await expect(page.getByRole('button', { name: 'Restart Laps', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Laps', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset Laps', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Laps', exact: true })).toBeVisible();
  await expect(label.getByLabel('Round 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Laps', exact: true })).toHaveCount(0);
});

test('running timer and reset button fit a narrow phone', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Edit rest', exact: true }).click();
  await page.getByRole('textbox', { name: 'Hours', exact: true }).fill('99');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('button', { name: 'Start rest', exact: true }).click();
  const button = page.getByRole('button', { name: 'Reset rest', exact: true });
  await expect(button).toBeInViewport();
  const timeBounds = await page.getByTestId('countdown-sample-0').boundingBox();
  const resetBounds = await button.boundingBox();
  expect(timeBounds ? timeBounds.x + timeBounds.width : Infinity).toBeLessThanOrEqual(resetBounds?.x ?? 0);
  await capture(page, info, 'narrow-running-reset.png');
  await button.click();
  await expect(page.getByRole('button', { name: 'Start rest', exact: true })).toBeVisible();
});

test('repeats exactly the requested rounds and can restart', async ({ page }, info) => {
  await page.clock.install();
  await createTimer(page, 'Round', 2, 3);
  await page.getByRole('button', { name: 'Start Round', exact: true }).click();
  await page.clock.fastForward(2100);
  await expect(page.getByRole('button', { name: 'Edit Round', exact: true }).getByLabel('Round 2 of 3', { exact: true })).toBeVisible();
  await page.clock.fastForward(2100);
  await expect(page.getByRole('button', { name: 'Edit Round', exact: true }).getByLabel('Round 3 of 3', { exact: true })).toBeVisible();
  await page.clock.fastForward(2100);
  await expect(page.getByRole('button', { name: 'Restart Round', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Round', exact: true })).toContainText('00:00');
  await capture(page, info, 'completed-timer.png');
  await page.getByRole('button', { name: 'Restart Round', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Round', exact: true }).getByLabel('Round 1 of 3', { exact: true })).toBeVisible();
});

test('completion plays real audio; muted timers do not', async ({ page }) => {
  await page.evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const muted = this.muted;
      return play.call(this).then(() => {
        if (!muted) document.documentElement.dataset.alarmPlays = String(Number(document.documentElement.dataset.alarmPlays || 0) + 1);
      });
    };
  });
  await createTimer(page, 'Sound', 1);
  await page.getByRole('button', { name: 'Start Sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restart Sound', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Number(document.documentElement.dataset.alarmPlays || 0))).toBeGreaterThan(0);
  await reset(page, 'Sound');
  await page.getByRole('button', { name: 'Edit Sound', exact: true }).click();
  await page.getByRole('tab', { name: 'Tone', exact: true }).click();
  await page.getByRole('switch', { name: 'Alarm sound', exact: true }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  const before = await page.evaluate(() => Number(document.documentElement.dataset.alarmPlays || 0));
  await page.getByRole('button', { name: 'Start Sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restart Sound', exact: true })).toBeVisible();
  expect(await page.evaluate(() => Number(document.documentElement.dataset.alarmPlays || 0))).toBe(before);
});

test('hidden but unsuspended browser tabs still attempt alarms', async ({ page }) => {
  await createTimer(page, 'Background', 1);
  await page.evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.muted) document.documentElement.dataset.hiddenAlarm = 'attempted';
      return play.call(this);
    };
  });
  await page.getByRole('button', { name: 'Start Background', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Restart Background', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hiddenAlarm)).toBe('attempted');
});

test('blocked audio shows an error', async ({ page }) => {
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('Sound is blocked', 'NotAllowedError')); };
  });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Test alarm sound', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Allow sound');
});

test('reorder, sort, duplicate, and delete persist', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Reorder timers', exact: true }).click();
  await page.getByRole('button', { name: 'Move rest down', exact: true }).click();
  await page.getByRole('button', { name: 'Done reordering', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId(/^timer-sample-/).first()).toHaveAttribute('data-testid', 'timer-sample-1');
  await page.getByRole('button', { name: 'Sort timers', exact: true }).click();
  await page.getByRole('button', { name: 'Duration · shortest first', exact: true }).click();
  await expect(page.getByTestId(/^timer-sample-/).first()).toHaveAttribute('data-testid', 'timer-sample-2');
  await page.getByRole('button', { name: 'Options for short rest', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate timer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start short rest copy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Options for short rest copy', exact: true }).click();
  await page.getByRole('button', { name: 'Delete timer', exact: true }).click();
  await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start short rest copy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Options for short rest copy', exact: true }).click();
  await page.getByRole('button', { name: 'Delete timer', exact: true }).click();
  await page.getByRole('button', { name: 'DELETE', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start short rest copy', exact: true })).toHaveCount(0);
});

test('empty library stays empty and the top-bar button creates a timer', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('timerlist:timers', '[]'));
  await page.reload();
  await expect(page.getByTestId(/^timer-sample-/)).toHaveCount(0);
  await createTimer(page, 'First');
  await expect(page.getByRole('button', { name: 'Start First', exact: true })).toBeVisible();
});

test('corrupt saved data is preserved', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('timerlist:timers', 'not-json'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Nothing was overwritten');
  expect(await page.evaluate(() => localStorage.getItem('timerlist:timers'))).toBe('not-json');
});

test('small phone editor and hour timers fit', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Add timer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Timer label' }).fill('Long timer');
  await page.getByRole('textbox', { name: 'Hours', exact: true }).fill('99');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  const timer = page.getByRole('button', { name: 'Edit Long timer', exact: true });
  await timer.scrollIntoViewIfNeeded();
  await expect(timer).toContainText('99:01:00');
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await timer.click();
  await page.getByRole('tab', { name: 'Tone', exact: true }).click();
  await expect(page.getByRole('button', { name: 'OK', exact: true })).toBeInViewport();
  await capture(page, info, 'small-phone-editor.png');
  await page.getByRole('button', { name: 'CANCEL', exact: true }).click();
});
