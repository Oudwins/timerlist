# Timerlist

A timer app for Android, iOS, and the browser, styled with **NativeWind**. The list, circular controls, and Time / Repeat / Color / Tone editor follow the reference screenshots.

## What it does

- Create, edit, duplicate, and delete labelled timers.
- Run and pause several timers independently.
- Pause, resume, reset, and restart completed timers.
- Choose from 20 colors and three locally bundled alarm sounds; preview sounds, mute, or enable vibration.
- Run a timer **1–99 times total**, with automatic next rounds and an alert at every boundary.
- Reorder with accessible up/down controls, or sort by label/duration.
- Save definitions, ordering, and running/paused state on the device. Reloading does not reset countdowns.

Six example timers appear on first launch. Delete them to start with an empty library; an empty library stays empty.

## Run

Use Node.js 24 and npm.

```sh
npm ci
npm run web
```

Open the terminal's URL (normally **http://localhost:8081**). The web version runs entirely on your machine. Project scripts disable Expo telemetry and use offline CLI mode; there is **no Expo login or hosted service** involved. npm still needs internet access to download dependencies initially.

Quick manual check: tap the small clock-plus button in the top bar, create a 5-second timer with 3 rounds, and press OK. Start it alongside another timer, pause/resume one, and listen for each round's alarm. Tap a label to edit it. Open the left-hand row icon for reset/delete, or the menu to reorder. Reload to check persistence. Keep the browser tab open for alarms.

For the full Android experience—including locked-screen alarms—install the standalone APK described below. The APK works offline and does not require Expo Go or a development server.

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

The browser suite builds and tests the **production web export** in desktop and mobile Chromium, including actual audio playback, concurrent timers, repeat boundaries, persistence, editing, ordering, deletion, invalid data, and small-phone layout. Reports/screenshots are in `playwright-report/` and `test-results/` (gitignored). To use an existing Chrome installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable.

`npm run build:web` produces the static website in `dist/`.

## Automatic Android APK releases

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on **every push to `main`**, or manually through Actions. It:

1. Runs lint, TypeScript, unit tests, and desktop/mobile browser tests.
2. Starts releases at **`0.0.1`** and increments only the last number: `0.0.2`, `0.0.3`, etc. The next patch is based on published `0.0.x` releases, not the workflow run number, so failed builds do not consume release numbers. Android's numeric version code also increases with each release and stays above the earlier `1.0.x` builds.
3. Generates the native Android project **locally on the GitHub runner**, compiles it with Gradle, and signs/verifies the APK with the Android SDK tools.
4. Creates a GitHub Release containing **`timerlist.apk`**, also available as an Actions artifact.

Download releases at **https://github.com/Oudwins/timerlist/releases**. Once the first release exists, the stable download URL is **https://github.com/Oudwins/timerlist/releases/latest/download/timerlist.apk**. The APK does not need a development server. Android may ask you to allow installation from your browser.

Releases are queued and built one at a time to avoid duplicate version numbers when multiple commits are pushed together. The release tag (`v0.0.x`), title (`0.0.x`), and APK version name agree. CI verifies the APK's package ID and version before publication. Each release contains one signed, universal `timerlist.apk` and is explicitly marked as the latest stable release.

### Install and update with Obtainium

[Add Timerlist to Obtainium](https://apps.obtainium.imranr.dev/redirect?r=obtainium://app/%7B%22id%22%3A%22com.oudwins.timerlist%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FOudwins%2Ftimerlist%22%2C%22author%22%3A%22Oudwins%22%2C%22name%22%3A%22Timerlist%22%7D)

Or open Obtainium → **Add App** and paste **`https://github.com/Oudwins/timerlist`**, then add/install it using the GitHub source. No APK filter or prerelease setting is needed: there is only one APK, and releases use standard versions. Obtainium can then detect and install subsequent releases. Android's installation permissions and Obtainium's background-update settings still apply.

For a **private repository**, Obtainium also needs a GitHub token with read access to that repository. Unauthenticated downloads for other users require a public repository or public release mirror; the workflow does not change repository visibility.

The application ID (`com.oudwins.timerlist`) and signing key stay the same across releases. If you installed an earlier `1.0.x` build, install the first `0.0.1` APK once before setting up tracking for the new series. Its higher internal Android version code allows updating without uninstalling or deleting saved timers.

No Expo services, accounts, tokens, EAS projects, push services, or OTA updates are used. Expo remains an open-source framework/build dependency only. GitHub runners download npm, Maven, and Android SDK dependencies as needed.

### Build caching and timings

Release builds retain support for all four Android ABIs. Gradle's **build cache** reuses compiled Java/Kotlin tasks, while a separately persisted **ccache** reuses native C/C++ compilation across fresh runners. The compiler cache is keyed by dependency versions and validates compiler contents, including support for precompiled headers. The first build populates these caches; subsequent builds with unchanged native dependencies can reuse them.

CI reports compiler-cache hits in the job summary and saves an **`android-build-profile`** artifact containing Gradle's per-task timing report. It uses a bounded 3 GiB Gradle heap and two workers for the standard private-repository runner; it does not select a paid larger runner or disable release optimization, signing, or tests. Actual improvements should be checked from the timing reports rather than assuming a fixed build time.

On disposable Linux GitHub-hosted runners only, setup removes the image's unused .NET, Swift, GHC, and CodeQL toolchains and uses `sdkmanager` to prune unused SDK versions. Java, the required Android SDKs, and the workspace are preserved. Preflight requires 20 GiB free before restoring build inputs and 16 GiB of working space afterward, accounting for the disk already occupied by restored caches. Cleanup refuses to run locally or on self-hosted runners.

After a successful build has populated the caches, run `gh workflow run release.yml -f publish=false` to measure a warm build on a fresh runner without publishing another release or consuming a version number.

### One-time Android signing setup

Android requires a persistent private signing key so a new APK can update an existing installation. With a JDK (`keytool`) and authenticated GitHub CLI installed, run once from the repository:

```sh
npm run setup:android-signing -- --github
```

This creates a private key in the gitignored **`.signing/android-signing.json`** file and stores it in the encrypted repository Actions secret **`ANDROID_SIGNING_KEY`**. It does not replace an existing GitHub signing secret. **Back up this file securely; never commit or share it.** A lost/replaced key means existing installations cannot update normally.

Push the app and workflows to `main`; the APK will appear under **Releases** after the build finishes. Subsequent pushes release automatically. You do not need an Android SDK installed locally when using GitHub Actions. Actions must be enabled; the workflow uses GitHub's built-in token with `contents: write`, not a separate PAT. Pull requests run [checks](.github/workflows/check.yml) without release secrets.

### Build/test Android entirely on your own machine

On Linux/macOS (or WSL), install **JDK 21** and the current Android SDK command-line tools, set `ANDROID_HOME`, and install SDK packages `platforms;android-37.0`, `build-tools;37.0.0`, `platform-tools`, `ndk;27.1.12297006`, and `cmake;3.22.1`. Accept the SDK licenses with `sdkmanager --licenses`.

```sh
npm run setup:android-signing
npm run build:android
adb install -r timerlist.apk
```

Enable USB debugging and connect a phone (or start an emulator) for `adb install`. The resulting **`timerlist.apk`** is a standalone release build. `npm run android` instead builds/launches the local development version with Metro; it also requires the Android SDK. Keep generated `android/` files out of Git and change native configuration through `app.json` and config plugins only.

To test background behavior, create a short timer, allow notification/exact-alarm permissions, lock the phone, and confirm it alerts. Also pause/reset/delete a running timer and confirm its old alert is cancelled. Use the same signing key locally and on GitHub if installing one build over the other.

## Alarm behavior

- **Android:** upcoming repeat alerts are scheduled with the operating system, including while the screen is locked or the app is backgrounded. Allow notification and exact-alarm permissions. `USE_EXACT_ALARM` is declared because timing is the app’s core purpose; Android 12 devices may still require an explicit grant. Pausing, resetting, editing, or deleting cancels the corresponding scheduled alerts.
- **iOS:** the same local-notification mechanism is used, with the system limit of 64 pending alerts across the app. Longer sessions require keeping the app open; a warning is shown if the queue is exceeded. iOS builds/signing are not part of the Android release workflow.
- **Browser:** keep the tab open and the device awake. Browsers can throttle or suspend tabs, so a website cannot guarantee locked-screen/background alarms. The app requests a screen wake lock where supported. Closed tabs cannot play sound; reopening reconciles elapsed rounds from their saved deadlines.
- System volume, Do Not Disturb, battery restrictions, and force-stopping the app can affect native alerts. Use the app’s alarm settings to test sound and open system settings.

Countdowns use wall-clock deadlines, not accumulated interval ticks, so delayed callbacks do not cause drift. Finite repeat schedules are queued in advance; no network connection, background polling service, or push notification account is needed. Data stays in local AsyncStorage; clearing app/site data removes it. Unreadable stored data is preserved rather than silently overwritten.

## Assets and dependencies

DM Sans and DM Mono are bundled under the SIL Open Font License (licenses in `assets/fonts/`). Timer sounds and app icons are generated locally by `node scripts/generate-assets.mjs` and bundled for offline use.

Expo SDK 58 dependency compatibility is checked with `npx expo-doctor`. The dependency tree currently has upstream npm audit advisories affecting Metro/Expo and Tailwind build tooling. Avoid `npm audit fix --force`: its suggested SDK downgrades are incompatible with this project. Review compatible upstream fixes as they become available.
