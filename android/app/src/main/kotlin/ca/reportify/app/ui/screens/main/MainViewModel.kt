package ca.reportify.app.ui.screens.main

import android.content.Context
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.WorkManager
import ca.reportify.app.data.local.dao.EntryDao
import ca.reportify.app.data.local.dao.PhotoDao
import ca.reportify.app.data.local.entities.EntryEntity
import ca.reportify.app.data.local.entities.PhotoEntity
import ca.reportify.app.data.local.entities.UploadStatus
import ca.reportify.app.data.remote.api.ReportifyApi
import ca.reportify.app.utils.AudioRecorder
import ca.reportify.app.utils.LocationProvider
import ca.reportify.app.utils.SessionManager
import ca.reportify.app.workers.SyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import timber.log.Timber
import java.io.File
import java.util.UUID
import javax.inject.Inject

data class MainUiState(
    val isRecording: Boolean = false,
    val pendingEntries: Int = 0,
    val pendingPhotos: Int = 0,
    val currentUserName: String = "",
    val detectedJobName: String? = null,
    val isOnline: Boolean = true,
    val lastRecordingDuration: String? = null,
    val error: String? = null,
)

@HiltViewModel
class MainViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val audioRecorder: AudioRecorder,
    private val locationProvider: LocationProvider,
    private val sessionManager: SessionManager,
    private val entryDao: EntryDao,
    private val photoDao: PhotoDao,
    private val api: ReportifyApi,
    private val workManager: WorkManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    private var currentAudioFile: File? = null

    init {
        viewModelScope.launch {
            sessionManager.userNameFlow.collect { name ->
                _uiState.update { it.copy(currentUserName = name ?: "") }
            }
        }
        viewModelScope.launch {
            entryDao.getPendingCountFlow().combine(photoDao.getPendingCountFlow()) { e, p -> e to p }
                .collect { (entries, photos) ->
                    _uiState.update { it.copy(pendingEntries = entries, pendingPhotos = photos) }
                }
        }
        refreshJobDetection()
    }

    fun startRecording() {
        if (audioRecorder.isRecording) return
        try {
            val file = audioRecorder.startRecording()
            currentAudioFile = file
            _uiState.update { it.copy(isRecording = true, error = null) }
            Timber.d("Recording started")
        } catch (e: Exception) {
            Timber.e(e, "Failed to start recording")
            _uiState.update { it.copy(error = "Could not start recording: ${e.message}") }
        }
    }

    fun stopRecording() {
        val result = audioRecorder.stopRecording() ?: return
        _uiState.update { it.copy(isRecording = false) }

        viewModelScope.launch {
            val userId = sessionManager.getUserId() ?: return@launch
            val orgId = sessionManager.getOrgId() ?: return@launch
            val location = locationProvider.getLastLocation()

            val entry = EntryEntity(
                id = UUID.randomUUID().toString(),
                userId = userId,
                organizationId = orgId,
                audioFilePath = result.file.absolutePath,
                durationSeconds = result.durationSeconds,
                latitude = location?.latitude,
                longitude = location?.longitude,
                gpsAccuracy = location?.accuracy,
                recordedAt = System.currentTimeMillis(),
                uploadStatus = UploadStatus.PENDING,
                deviceMetaJson = buildDeviceMeta(),
            )

            entryDao.insert(entry)

            val minutes = (result.durationSeconds / 60).toInt()
            val seconds = (result.durationSeconds % 60).toInt()
            _uiState.update {
                it.copy(lastRecordingDuration = "${minutes}m ${seconds}s saved")
            }

            Timber.d("Entry saved locally: ${entry.id}")
            triggerSync()
        }
    }

    fun savePhoto(filePath: String, mimeType: String, fileSizeBytes: Long) {
        viewModelScope.launch {
            val userId = sessionManager.getUserId() ?: return@launch
            val orgId = sessionManager.getOrgId() ?: return@launch
            val location = locationProvider.getLastLocation()

            val photo = PhotoEntity(
                id = UUID.randomUUID().toString(),
                userId = userId,
                organizationId = orgId,
                filePath = filePath,
                thumbnailPath = null,
                mimeType = mimeType,
                fileSizeBytes = fileSizeBytes,
                latitude = location?.latitude,
                longitude = location?.longitude,
                gpsAccuracy = location?.accuracy,
                takenAt = System.currentTimeMillis(),
                uploadStatus = UploadStatus.PENDING,
                deviceMetaJson = buildDeviceMeta(),
            )

            photoDao.insert(photo)
            Timber.d("Photo saved locally: ${photo.id}")
            triggerSync()
        }
    }

    fun triggerSync() {
        val request = SyncWorker.buildRequest()
        workManager.enqueueUniqueWork(
            SyncWorker.WORK_NAME,
            androidx.work.ExistingWorkPolicy.KEEP,
            request,
        )
        Timber.d("Sync triggered")
    }

    private fun refreshJobDetection() {
        viewModelScope.launch {
            try {
                val location = locationProvider.getLastLocation() ?: return@launch
                val jobs = api.getJobs().data ?: return@launch

                val earthRadius = 6371000.0
                var bestJob: Pair<String, Double>? = null

                for (job in jobs) {
                    if (!job.isActive || job.latitude == null || job.longitude == null) continue
                    val dLat = Math.toRadians(location.latitude - job.latitude)
                    val dLon = Math.toRadians(location.longitude - job.longitude)
                    val a = Math.sin(dLat / 2).pow(2.0) +
                            Math.cos(Math.toRadians(job.latitude)) * Math.cos(Math.toRadians(location.latitude)) *
                            Math.sin(dLon / 2).pow(2.0)
                    val dist = earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                    if (dist <= job.radiusMeters) {
                        if (bestJob == null || dist < bestJob.second) {
                            bestJob = job.name to dist
                        }
                    }
                }

                _uiState.update { it.copy(detectedJobName = bestJob?.first) }
            } catch (e: Exception) {
                Timber.w(e, "Job detection failed")
            }
        }
    }

    private fun buildDeviceMeta(): String {
        return """{"manufacturer":"${Build.MANUFACTURER}","model":"${Build.MODEL}","sdk":${Build.VERSION.SDK_INT}}"""
    }

    fun clearError() = _uiState.update { it.copy(error = null) }
    fun setError(msg: String) = _uiState.update { it.copy(error = msg) }
}

private fun Double.pow(exp: Double) = Math.pow(this, exp)
