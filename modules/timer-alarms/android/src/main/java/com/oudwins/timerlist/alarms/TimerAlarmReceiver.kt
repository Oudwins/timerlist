package com.oudwins.timerlist.alarms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TimerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "FIRE") {
      val identifier = intent.getStringExtra("identifier") ?: return
      val alarm = AlarmStore.read(context, "scheduled").optJSONObject(identifier) ?: return
      AlarmStore.deliver(context, alarm)
    } else {
      AlarmStore.restore(context)
    }
  }
}
