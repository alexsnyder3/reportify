package ca.reportify.app.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.*
import ca.reportify.app.data.local.dao.EntryDao
import ca.reportify.app.data.local.dao.PhotoDao
import ca.reportify.app.data.local.entities.UploadStatus
import ca.reportify.app.data.remote.api.ReportifyApi
import ca.reportify.app.utils.SessionManager
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import timber.log.Timber
import java.io.File
import java.time.Instant
import java.time.format.DateTimeFormatter

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val api: ReportifyApi,
    private val entryDao: EntryDao,
    private val photoDao: PhotoDao,
    private val session: SessionManager,
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        Timber.d("SyncWorker: starting sync")

        val token = session.getToken() ?: run {
            Timber.w("No token, skipping sync")
            return Result.success()
        }

        var anyFailure = false

        // Upload pending audio entries
        val pendingEntries = entryDao.getPendingUploads()
        Timber.d("SyncWorker: ${pendingEntries.size} pending entries")

        for (entry in pendingEntries) {
            if (entry.uploadAttempts >= MAX_RETRIES) {
                Timber.w("Entry ${entry.id} exceeded max retries, marking failed")
                entryDao.updateStatus(entry.id, UploadStatus.FAILED, "Max retries exceeded")
                continue
            }

            val file = File(entry.audioFilePath)
            if (!file.exists()) {
                entryDao.updateStatus(entry.id, UploadStatus.FAILED, "Audio file missing")
                continue
            }

            entryDao.updateStatus(entry.id, UploadStatus.UPLOADING)

            try {
                val audioPart = MultipartBody.Part.createFormData(
                    "audio",
                    file.name,
                    file.asRequestBody("audio/m4a".toMediaTypeOrNull()),
                )

                val recordedAtStr = DateTimeFormatter.ISO_INSTANT.format(
                    Instant.ofEpochMilli(entry.recordedAt)
                )

                val response = api.uploadAudio(
                    audio = audioPart,
                    recordedAt = recordedAtStr.toRequestBody("text/plain".toMediaTypeOrNull()),
                    durationSeconds = entry.durationSeconds?.toString()?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    latitude = entry.latitude?.toString()?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    longitude = entry.longitude?.toString()?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    gpsAccuracy = entry.gpsAccuracy?.toString()?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    deviceEntryId = entry.id.toRequestBody("text/plain".toMediaTypeOrNull()),
                    deviceMeta = entry.deviceMetaJson?.toRequestBody("application/json".toMediaTypeOrNull()),
                )

                if (response.success && response.data != null) {
                    entryDao.markUploaded(entry.id, response.data.entryId)
                    Timber.d("Entry ${entry.id} uploaded successfully")
                } else {
                    val err = response.error?.message ?: "Unknown error"
                    entryDao.updateStatus(entry.id, UploadStatus.FAILED, err)
                    anyFailure = true
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to upload entry ${entry.id}")
                entryDao.updateStatus(entry.id, UploadStatus.PENDING, e.message)
                anyFailure = true
            }
        }

        // Upload pending photos
        val pendingPhotos = photoDao.getPendingUploads()
        Timber.d("SyncWorker: ${pendingPhotos.size} pending photos")

        for (photo in pendingPhotos) {
            if (photo.uploadAttempts >= MAX_RETRIES) {
                photoDao.updateStatus(photo.id, UploadStatus.FAILED, "Max retries exceeded")
                continue
            }

            val file = File(photo.filePath)
            if (!file.exists()) {
                photoDao.updateStatus(photo.id, UploadStatus.FAILED, "Photo file missing")
                continue
            }

            photoDao.updateStatus(photo.id, UploadStatus.UPLOADING)

            try {
                val photoPart = MultipartBody.Part.createFormData(
                    "photo",
                    file.name,
                    file.asRequestBody(photo.mimeType.toMediaTypeOrNull()),
                )

                val takenAtStr = DateTimeFormatter.ISO_INSTANT.format(
                    Instant.ofEpochMilli(photo.takenAt)
                )

                val response = api.uploadPhoto(
                    photo = photoPart,
                    takenAt = takenAtStr.toRequestBody("text/plain".toMediaTypeOrNull()),
                    latitude = photo.latitude?.toString()?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    longitude = photo.longitude?.toString()?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    gpsAccuracy = photo.gpsAccuracy?.toString()?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    devicePhotoId = photo.id.toRequestBody("text/plain".toMediaTypeOrNull()),
                    deviceMeta = photo.deviceMetaJson?.toRequestBody("application/json".toMediaTypeOrNull()),
                )

                if (response.success && response.data != null) {
                    photoDao.markUploaded(photo.id, response.data.photoId)
                    Timber.d("Photo ${photo.id} uploaded successfully")
                } else {
                    val err = response.error?.message ?: "Unknown error"
                    photoDao.updateStatus(photo.id, UploadStatus.FAILED, err)
                    anyFailure = true
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to upload photo ${photo.id}")
                photoDao.updateStatus(photo.id, UploadStatus.PENDING, e.message)
                anyFailure = true
            }
        }

        return if (anyFailure) Result.retry() else Result.success()
    }

    companion object {
        const val MAX_RETRIES = 5
        const val WORK_NAME = "reportify_sync"

        fun buildRequest(): OneTimeWorkRequest {
            return OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30_000, java.util.concurrent.TimeUnit.MILLISECONDS)
                .build()
        }

        fun buildPeriodicRequest(): PeriodicWorkRequest {
            return PeriodicWorkRequestBuilder<SyncWorker>(
                15, java.util.concurrent.TimeUnit.MINUTES
            )
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
        }
    }
}
