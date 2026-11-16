package com.mohd4monish.videotimmer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.Point
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Toast
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

class FloatingOverlayService : Service() {

    enum class BubbleState {
        IDLE,
        LOADING,
        SUCCESS,
        ERROR
    }

    companion object {
        const val ACTION_START = "com.mohd4monish.videotimmer.START_FLOATING_CLIPPER"
        const val ACTION_STOP = "com.mohd4monish.videotimmer.STOP_FLOATING_CLIPPER"
        const val EXTRA_TARGET_FOLDER = "extra_target_folder"
        const val EXTRA_SERVER_URL = "extra_server_url"

        private const val CHANNEL_ID = "vt_floating_clipper_channel"
        private const val NOTIFICATION_ID = 9182
        private const val TAG = "VT_FloatingOverlay"
        var isRunning = false
    }

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var params: WindowManager.LayoutParams? = null

    private var targetFolder: String = "Shorts"
    private var serverUrl: String = "https://clip-queue-server.vercel.app"

    private val mainHandler = Handler(Looper.getMainLooper())
    private var currentState: BubbleState = BubbleState.IDLE
    private var lastSavedUrl: String = ""

    private var clipboardListener: ClipboardManager.OnPrimaryClipChangedListener? = null

    private val revertToIdleRunnable = Runnable {
        setBubbleState(BubbleState.IDLE)
        requestWindowFocus(false)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        targetFolder = intent?.getStringExtra(EXTRA_TARGET_FOLDER) ?: "Shorts"
        serverUrl = intent?.getStringExtra(EXTRA_SERVER_URL) ?: "https://clip-queue-server.vercel.app"

        startForeground(NOTIFICATION_ID, createNotification())
        initFloatingBubble()
        initClipboardListener()

        isRunning = true
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        removeClipboardListener()
        mainHandler.removeCallbacksAndMessages(null)
        removeFloatingBubble()
        isRunning = false
    }

    private fun createNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "VideoTimmer Floating Clipper",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the floating social clipper active."
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VideoTimmer Floating Clipper")
            .setContentText("Keeps the floating social clipper active.")
            .setSmallIcon(R.drawable.vt_bubble_icon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    fun isValidSocialUrl(url: String): Boolean {
        if (url.isBlank()) return false
        val lower = url.lowercase().trim()
        return lower.contains("instagram.com") ||
               lower.contains("instagr.am") ||
               lower.contains("youtube.com") ||
               lower.contains("youtu.be") ||
               lower.contains("tiktok.com")
    }

    fun readClipboardText(): String {
        return try {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            clipboard?.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read clipboard: ${e.message}")
            ""
        }
    }

    private fun initClipboardListener() {
        try {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            clipboardListener = ClipboardManager.OnPrimaryClipChangedListener {
                val clipText = readClipboardText()
                if (isValidSocialUrl(clipText) && clipText != lastSavedUrl) {
                    lastSavedUrl = clipText
                    dispatchToBackend(clipText)
                }
            }
            clipboard?.addPrimaryClipChangedListener(clipboardListener)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register clipboard listener: ${e.message}")
        }
    }

    private fun removeClipboardListener() {
        try {
            if (clipboardListener != null) {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                clipboard?.removePrimaryClipChangedListener(clipboardListener)
                clipboardListener = null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove clipboard listener: ${e.message}")
        }
    }

    private fun initFloatingBubble() {
        if (floatingView != null) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Please grant 'Display over other apps' permission first.", Toast.LENGTH_LONG).show()
            stopSelf()
            return
        }

        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val inflater = LayoutInflater.from(this)
        floatingView = inflater.inflate(R.layout.vt_floating_bubble_layout, null)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 20
            y = 350
        }

        try {
            windowManager?.addView(floatingView, params)
            setupTouchListener()
            setBubbleState(BubbleState.IDLE)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to attach floating overlay: ${e.message}")
            stopSelf()
        }
    }

    private fun setupTouchListener() {
        val root = floatingView?.findViewById<View>(R.id.vt_bubble_root) ?: floatingView ?: return

        root.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f
            private var touchStartTime = 0L

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                val currentParams = params ?: return false

                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = currentParams.x
                        initialY = currentParams.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        touchStartTime = System.currentTimeMillis()
                        v.animate().scaleX(1.08f).scaleY(1.08f).setDuration(100).start()
                        return true
                    }

                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initialTouchX).toInt()
                        val dy = (event.rawY - initialTouchY).toInt()
                        currentParams.x = initialX + dx
                        currentParams.y = initialY + dy
                        windowManager?.updateViewLayout(floatingView, currentParams)
                        return true
                    }

                    MotionEvent.ACTION_UP -> {
                        v.animate().scaleX(1.0f).scaleY(1.0f).setDuration(120).start()
                        val elapsed = System.currentTimeMillis() - touchStartTime
                        val totalDeltaX = abs(event.rawX - initialTouchX)
                        val totalDeltaY = abs(event.rawY - initialTouchY)

                        // If touch moved less than 14 pixels and took less than 400ms, it is a TAP
                        if (totalDeltaX < 14 && totalDeltaY < 14 && elapsed < 400) {
                            handleBubbleClick()
                        } else {
                            snapToClosestEdge(currentParams)
                        }
                        return true
                    }
                }
                return false
            }
        })
    }

    private fun snapToClosestEdge(currentParams: WindowManager.LayoutParams) {
        val display = windowManager?.defaultDisplay
        val size = Point()
        display?.getSize(size)
        val screenWidth = size.x

        val targetX = if (currentParams.x + (floatingView?.width ?: 100) / 2 < screenWidth / 2) {
            10 // Snap to left edge
        } else {
            screenWidth - (floatingView?.width ?: 120) - 10 // Snap to right edge
        }

        currentParams.x = targetX
        windowManager?.updateViewLayout(floatingView, currentParams)
    }

    /**
     * Momentarily requests or releases window focus so Android OS grants clipboard read access.
     */
    fun requestWindowFocus(enableFocus: Boolean) {
        val p = params ?: return
        if (enableFocus) {
            p.flags = p.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
        } else {
            p.flags = p.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        }
        try {
            windowManager?.updateViewLayout(floatingView, p)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update window focus flags: ${e.message}")
        }
    }

    /**
     * Handles tapping the floating model.
     * Takes the video link from clipboard and saves it to the database.
     * Never opens or clicks any share popups.
     */
    private fun handleBubbleClick() {
        if (currentState == BubbleState.LOADING) {
            return
        }

        // Momentarily acquire window focus so Android OS grants clipboard read access on Samsung
        requestWindowFocus(true)

        val clipText = readClipboardText()

        if (isValidSocialUrl(clipText)) {
            lastSavedUrl = clipText
            dispatchToBackend(clipText)
        } else {
            setBubbleState(BubbleState.ERROR, "Copy link on post first, then tap bubble to save.")
            requestWindowFocus(false)
        }
    }

    fun dispatchToBackend(url: String) {
        setBubbleState(BubbleState.LOADING)
        val cleanServer = serverUrl.trimEnd('/')
        val endpoint = "$cleanServer/api/queue"

        val platformLabel = when {
            url.contains("youtube") || url.contains("youtu.be") -> "YouTube Shorts"
            url.contains("tiktok") -> "TikTok"
            else -> "Instagram Reel"
        }

        Thread {
            try {
                val conn = URL(endpoint).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 7000
                conn.readTimeout = 9000
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("url", url)
                    put("folderName", if (targetFolder.isNotBlank()) targetFolder else "Shorts")
                    put("folderId", if (targetFolder.isNotBlank()) targetFolder else "Shorts")
                    put("description", "Captured via VideoTimmer Quick Bubble")
                    put("notes", "Auto-captured from $platformLabel")
                    put("sourceClient", "android_floating_clipper")
                }

                val writer = OutputStreamWriter(conn.outputStream)
                writer.write(payload.toString())
                writer.flush()
                writer.close()

                val code = conn.responseCode
                if (code in 200..299) {
                    val folderDisplay = if (targetFolder == "local") "Local Storage" else targetFolder
                    setBubbleState(BubbleState.SUCCESS, "Saved $platformLabel to $folderDisplay")
                } else {
                    setBubbleState(BubbleState.ERROR, "Server returned code $code")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Network error saving clip: ${e.message}")
                setBubbleState(BubbleState.ERROR, "Failed to reach server")
            } finally {
                requestWindowFocus(false)
            }
        }.start()
    }

    fun setBubbleState(state: BubbleState, message: String? = null) {
        currentState = state
        mainHandler.post {
            val root = floatingView ?: return@post
            val circle = root.findViewById<FrameLayout>(R.id.vt_bubble_circle) ?: return@post
            val iconView = root.findViewById<ImageView>(R.id.vt_bubble_icon_view)
            val loader = root.findViewById<ProgressBar>(R.id.vt_bubble_loader)
            val checkView = root.findViewById<ImageView>(R.id.vt_bubble_check_view)
            val errorView = root.findViewById<ImageView>(R.id.vt_bubble_error_view)

            when (state) {
                BubbleState.IDLE -> {
                    circle.setBackgroundResource(R.drawable.vt_bubble_bg)
                    iconView?.visibility = View.VISIBLE
                    iconView?.alpha = 1.0f
                    loader?.visibility = View.GONE
                    checkView?.visibility = View.GONE
                    errorView?.visibility = View.GONE
                    circle.scaleX = 1.0f
                    circle.scaleY = 1.0f
                }

                BubbleState.LOADING -> {
                    circle.setBackgroundResource(R.drawable.vt_bubble_bg_loading)
                    iconView?.visibility = View.GONE
                    checkView?.visibility = View.GONE
                    errorView?.visibility = View.GONE
                    loader?.visibility = View.VISIBLE
                    circle.animate().scaleX(1.06f).scaleY(1.06f).setDuration(200).start()
                }

                BubbleState.SUCCESS -> {
                    circle.setBackgroundResource(R.drawable.vt_bubble_bg_success)
                    loader?.visibility = View.GONE
                    iconView?.visibility = View.GONE
                    errorView?.visibility = View.GONE
                    checkView?.visibility = View.VISIBLE

                    // Pop animation for checkmark
                    checkView?.scaleX = 0.3f
                    checkView?.scaleY = 0.3f
                    checkView?.animate()?.scaleX(1.15f)?.scaleY(1.15f)?.setDuration(180)?.withEndAction {
                        checkView.animate().scaleX(1.0f).scaleY(1.0f).setDuration(120).start()
                    }?.start()
                    circle.animate().scaleX(1.0f).scaleY(1.0f).setDuration(200).start()

                    triggerHapticFeedback()

                    if (!message.isNullOrBlank()) {
                        Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
                    }

                    // Hold checkmark for 2.2 seconds so user clearly sees link is saved
                    mainHandler.removeCallbacks(revertToIdleRunnable)
                    mainHandler.postDelayed(revertToIdleRunnable, 2200)
                }

                BubbleState.ERROR -> {
                    circle.setBackgroundResource(R.drawable.vt_bubble_bg_error)
                    loader?.visibility = View.GONE
                    iconView?.visibility = View.GONE
                    checkView?.visibility = View.GONE
                    errorView?.visibility = View.VISIBLE

                    // Subtle horizontal shake animation
                    circle.animate().translationX(12f).setDuration(60).withEndAction {
                        circle.animate().translationX(-12f).setDuration(60).withEndAction {
                            circle.animate().translationX(0f).setDuration(60).start()
                        }.start()
                    }.start()

                    if (!message.isNullOrBlank()) {
                        Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
                    }

                    mainHandler.removeCallbacks(revertToIdleRunnable)
                    mainHandler.postDelayed(revertToIdleRunnable, 2000)
                }
            }
        }
    }

    private fun triggerHapticFeedback() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(120, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v?.vibrate(VibrationEffect.createOneShot(120, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    v?.vibrate(120)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Vibration failed: ${e.message}")
        }
    }

    private fun removeFloatingBubble() {
        if (floatingView != null) {
            try {
                windowManager?.removeView(floatingView)
            } catch (e: Exception) {
                Log.e(TAG, "Error removing overlay view: ${e.message}")
            }
            floatingView = null
        }
    }
}
