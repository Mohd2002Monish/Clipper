package com.mohd4monish.videotimmer

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FloatingClipperBridge(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FloatingClipperBridge"

    @ReactMethod
    fun startFloatingClipper(targetFolder: String, serverUrl: String, promise: Promise) {
        val context = reactApplicationContext

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            promise.reject("PERMISSION_DENIED", "Overlay permission (SYSTEM_ALERT_WINDOW) not granted.")
            return
        }

        try {
            val intent = Intent(context, FloatingOverlayService::class.java).apply {
                action = FloatingOverlayService.ACTION_START
                putExtra(FloatingOverlayService.EXTRA_TARGET_FOLDER, targetFolder)
                putExtra(FloatingOverlayService.EXTRA_SERVER_URL, serverUrl)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopFloatingClipper(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, FloatingOverlayService::class.java).apply {
                action = FloatingOverlayService.ACTION_STOP
            }
            context.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        promise.resolve(FloatingOverlayService.isRunning)
    }

    @ReactMethod
    fun isOverlayPermissionGranted(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun isAccessibilityPermissionGranted(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun openOverlaySettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactApplicationContext.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }
}

