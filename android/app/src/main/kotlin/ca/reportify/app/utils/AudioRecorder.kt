package ca.reportify.app.utils

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AudioRecorder @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private var recorder: MediaRecorder? = null
    private var currentFile: File? = null
    private var startTime: Long = 0L

    val isRecording: Boolean get() = recorder != null

    fun startRecording(): File {
        stopRecording() // safety

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val audioDir = File(context.filesDir, "audio").also { it.mkdirs() }
        val file = File(audioDir, "REC_$timestamp.m4a")

        recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }.apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(128_000)
            setAudioSamplingRate(44_100)
            setOutputFile(file.absolutePath)
            prepare()
            start()
        }

        currentFile = file
        startTime = System.currentTimeMillis()
        Timber.d("Recording started: ${file.absolutePath}")
        return file
    }

    fun stopRecording(): RecordingResult? {
        val rec = recorder ?: return null
        return try {
            rec.stop()
            rec.release()
            val duration = (System.currentTimeMillis() - startTime) / 1000f
            val file = currentFile!!
            Timber.d("Recording stopped: ${file.name}, duration: ${duration}s")
            RecordingResult(file = file, durationSeconds = duration)
        } catch (e: Exception) {
            Timber.e(e, "Error stopping recording")
            null
        } finally {
            recorder = null
            currentFile = null
        }
    }

    data class RecordingResult(val file: File, val durationSeconds: Float)
}
