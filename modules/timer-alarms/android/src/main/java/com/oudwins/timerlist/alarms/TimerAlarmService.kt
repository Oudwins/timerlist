package com.oudwins.timerlist.alarms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Log
import org.json.JSONObject

class TimerAlarmService : Service() {
  companion object {
    var instance: TimerAlarmService? = null
      private set
    private const val CHANNEL = "ringing-timers-v1"
    private const val NOTIFICATION = 7301
  }

  private val players = mutableMapOf<String, MediaPlayer>()
  private val playerAlarms = mutableMapOf<String, String>()
  private val vibrator get() = getSystemService(VIBRATOR_SERVICE) as Vibrator
  private var vibrating = false

  override fun onCreate() {
    super.onCreate()
    instance = this
    if (Build.VERSION.SDK_INT >= 26) {
      val channel = NotificationChannel(CHANNEL, "Ringing timers", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Timer alarms continue until Stop is pressed."
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "STOP") AlarmStore.write(this, "ringing", JSONObject())
    refresh()
    return if (AlarmStore.read(this, "ringing").length() == 0) START_NOT_STICKY else START_STICKY
  }

  fun refresh() {
    val ringing = AlarmStore.read(this, "ringing")
    if (ringing.length() == 0) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      releasePlayers()
      return
    }
    val alarms = ringing.keys().asSequence().map { ringing.getJSONObject(it) }.toList()
    val labels = alarms.map { alarm ->
      val timer = alarm.getJSONObject("timer")
      if (alarm.getInt("cycle") == timer.getInt("repeats")) "${timer.getString("label")} finished"
      else "${timer.getString("label")} · round ${alarm.getInt("cycle")} complete"
    }
    val stop = PendingIntent.getService(this, 0, Intent(this, TimerAlarmService::class.java).setAction("STOP"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(if (labels.size == 1) labels.first() else "${labels.size} timer alarms")
      .setContentText("${labels.joinToString(" · ")} — tap Stop to dismiss")
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setPriority(Notification.PRIORITY_MAX)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(AlarmStore.openApp(this))
      .setDeleteIntent(stop)
      .addAction(Notification.Action.Builder(null, "Stop", stop).build())
      .build()
    // Start foreground before loading audio, including for silent/vibration-only alarms.
    startForeground(NOTIFICATION, notification)
    for (id in players.keys.toList()) {
      if (!ringing.has(id)) {
        players.remove(id)?.release()
        playerAlarms.remove(id)
      }
    }
    for (alarm in alarms) {
      val timer = alarm.getJSONObject("timer")
      val id = timer.getString("id")
      if (!timer.getBoolean("sound") || playerAlarms[id] == alarm.getString("identifier")) continue
      players.remove(id)?.release()
      val player = MediaPlayer()
      try {
        player.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        player.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK)
        val resource = resources.getIdentifier(timer.getString("tone"), "raw", packageName)
        val source = if (resource != 0) Uri.parse("android.resource://$packageName/$resource") else Settings.System.DEFAULT_ALARM_ALERT_URI
        player.setDataSource(this, source)
        player.isLooping = true
        player.prepare()
        player.start()
        players[id] = player
        playerAlarms[id] = alarm.getString("identifier")
      } catch (error: Exception) {
        player.release()
        Log.e("TimerAlarms", "Unable to play alarm sound", error)
      }
    }
    val shouldVibrate = alarms.any { it.getJSONObject("timer").getBoolean("vibrate") }
    if (shouldVibrate && !vibrating) {
      val pattern = longArrayOf(0, 300, 150, 300, 1000)
      if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)) else vibrator.vibrate(pattern, 0)
    } else if (!shouldVibrate) vibrator.cancel()
    vibrating = shouldVibrate
  }

  private fun releasePlayers() {
    players.values.forEach { it.release() }
    players.clear()
    playerAlarms.clear()
    vibrator.cancel()
    vibrating = false
  }

  override fun onDestroy() {
    instance = null
    releasePlayers()
    super.onDestroy()
  }
}
