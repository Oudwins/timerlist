package com.oudwins.timerlist.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

// These methods run on Android's main thread (module, receiver, and service).
// The same alarm identifiers are used by the OS scheduler and foreground ticks.
object AlarmStore {
  fun preferences(context: Context) = context.getSharedPreferences("timerlist-alarms", Context.MODE_PRIVATE)
  fun read(context: Context, key: String) = JSONObject(preferences(context).getString(key, "{}")!!)
  fun write(context: Context, key: String, value: JSONObject) {
    check(preferences(context).edit().putString(key, value.toString()).commit()) { "Could not save alarms" }
  }

  private fun manager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun operation(context: Context, identifier: String) = PendingIntent.getBroadcast(
    context, 0,
    Intent(context, TimerAlarmReceiver::class.java).setAction("FIRE")
      .setData(Uri.fromParts("timerlist-alarm", identifier, null)).putExtra("identifier", identifier),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
    context, 0, context.packageManager.getLaunchIntentForPackage(context.packageName)!!,
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  private fun schedule(context: Context, alarm: JSONObject) {
    manager(context).setAlarmClock(
      AlarmManager.AlarmClockInfo(maxOf(System.currentTimeMillis() + 1, alarm.getLong("date")), openApp(context)),
      operation(context, alarm.getString("identifier"))
    )
  }

  fun sync(context: Context, json: String) {
    val now = System.currentTimeMillis()
    val old = read(context, "scheduled")
    val desired = JSONObject()
    val plan = JSONArray(json)
    for (index in 0 until plan.length()) {
      val alarm = plan.getJSONObject(index)
      desired.put(alarm.getString("identifier"), alarm)
    }
    // A tick can finish a round before Android's broadcast is processed.
    // Keep due deliveries until the receiver consumes them; never cancel them
    // merely because they disappeared from the future-only JS alarm plan.
    for (identifier in old.keys()) {
      val alarm = old.getJSONObject(identifier)
      if (!desired.has(identifier) && alarm.getLong("date") <= now) desired.put(identifier, alarm)
    }
    write(context, "scheduled", desired)
    for (identifier in old.keys()) {
      if (!desired.has(identifier)) {
        val pending = operation(context, identifier)
        manager(context).cancel(pending)
        pending.cancel()
      }
    }
    if (desired.length() == 0) return
    check(Build.VERSION.SDK_INT < 31 || manager(context).canScheduleExactAlarms()) {
      "Allow exact alarms in system settings for background alerts. In-app alarms still work."
    }
    for (identifier in desired.keys()) {
      schedule(context, desired.getJSONObject(identifier))
    }
  }

  fun restore(context: Context) {
    if (Build.VERSION.SDK_INT >= 31 && !manager(context).canScheduleExactAlarms()) return
    val scheduled = read(context, "scheduled")
    for (identifier in scheduled.keys()) {
      val alarm = scheduled.getJSONObject(identifier)
      if (alarm.getLong("date") > System.currentTimeMillis()) schedule(context, alarm)
    }
  }

  fun deliver(context: Context, alarm: JSONObject) {
    val scheduled = read(context, "scheduled")
    scheduled.remove(alarm.getString("identifier"))
    write(context, "scheduled", scheduled)
    val id = alarm.getJSONObject("timer").getString("id")
    val seen = read(context, "seen")
    if (seen.optLong(id) >= alarm.getLong("date")) return
    // Remember delivery after Stop too: a delayed tick must not ring it again.
    seen.put(id, alarm.getLong("date"))
    write(context, "seen", seen)
    val ringing = read(context, "ringing")
    ringing.put(id, alarm)
    write(context, "ringing", ringing)
    val intent = Intent(context, TimerAlarmService::class.java)
    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
  }

  fun dismiss(context: Context, id: String, cancelScheduled: Boolean) {
    val ringing = read(context, "ringing")
    ringing.remove(id)
    write(context, "ringing", ringing)
    // Also suppress any due broadcast racing with reset/edit/delete/restart.
    val scheduled = read(context, "scheduled")
    for (key in scheduled.keys().asSequence().toList()) {
      val alarm = scheduled.getJSONObject(key)
      val due = alarm.getLong("date") <= System.currentTimeMillis()
      if (alarm.getJSONObject("timer").getString("id") == id && (cancelScheduled || due)) {
        if (due) {
          val seen = read(context, "seen")
          seen.put(id, maxOf(seen.optLong(id), alarm.getLong("date")))
          write(context, "seen", seen)
        }
        scheduled.remove(key)
        manager(context).cancel(operation(context, key))
      }
    }
    write(context, "scheduled", scheduled)
    TimerAlarmService.instance?.refresh()
  }

  fun ringingMaps(context: Context): List<Map<String, Any>> {
    val ringing = read(context, "ringing")
    return ringing.keys().asSequence().map { id ->
      val alarm = ringing.getJSONObject(id)
      val timer = alarm.getJSONObject("timer")
      mapOf(
        "identifier" to alarm.getString("identifier"), "date" to alarm.getLong("date"), "cycle" to alarm.getInt("cycle"),
        "timer" to mapOf(
          "id" to id, "label" to timer.getString("label"), "tone" to timer.getString("tone"),
          "sound" to timer.getBoolean("sound"), "vibrate" to timer.getBoolean("vibrate"), "repeats" to timer.getInt("repeats")
        )
      )
    }.toList()
  }
}
