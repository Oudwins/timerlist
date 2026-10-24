package com.oudwins.timerlist.alarms

import android.content.SharedPreferences
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TimerAlarmsModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
    if (key == "ringing") sendEvent("onChange", mapOf("alarms" to AlarmStore.ringingMaps(context)))
  }

  override fun definition() = ModuleDefinition {
    Name("TimerAlarms")
    Events("onChange")

    OnStartObserving("onChange") {
      AlarmStore.preferences(context).registerOnSharedPreferenceChangeListener(listener)
    }
    OnStopObserving("onChange") {
      AlarmStore.preferences(context).unregisterOnSharedPreferenceChangeListener(listener)
    }
    OnDestroy {
      appContext.reactContext?.let { AlarmStore.preferences(it).unregisterOnSharedPreferenceChangeListener(listener) }
    }

    Function("getRingingAlarms") { AlarmStore.ringingMaps(context) }
    AsyncFunction("syncAlarms") { plan: String -> AlarmStore.sync(context, plan) }.runOnQueue(Queues.MAIN)
    AsyncFunction("presentAlarm") { alarm: String -> AlarmStore.deliver(context, org.json.JSONObject(alarm)) }.runOnQueue(Queues.MAIN)
    AsyncFunction("dismissAlarm") { id: String, cancelScheduled: Boolean -> AlarmStore.dismiss(context, id, cancelScheduled) }.runOnQueue(Queues.MAIN)
  }
}
