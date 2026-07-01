package ca.reportify.app.ui.screens.camera

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.ExistingWorkPolicy
import androidx.work.WorkManager
import ca.reportify.app.data.local.dao.PhotoDao
import ca.reportify.app.data.local.entities.PhotoEntity
import ca.reportify.app.data.local.entities.UploadStatus
import ca.reportify.app.utils.LocationProvider
import ca.reportify.app.utils.SessionManager
import ca.reportify.app.workers.SyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.launch
import timber.log.Timber
import java.io.File
import java.util.UUID
import android.os.Build
import javax.inject.Inject

@HiltViewModel
class CameraViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val photoDao: PhotoDao,
    private val locationProvider: LocationProvider,
    private val sessionManager: SessionManager,
    private val workManager: WorkManager,
) : ViewModel() {

    fun savePhoto(file: File) {
        viewModelScope.launch {
            try {
                val userId = sessionManager.getUserId() ?: return@launch
                val orgId = sessionManager.getOrgId() ?: return@launch
                val location = locationProvider.getLastLocation()

                val photo = PhotoEntity(
                    id = UUID.randomUUID().toString(),
                    userId = userId,
                    organizationId = orgId,
                    filePath = file.absolutePath,
                    thumbnailPath = null,
                    mimeType = "image/jpeg",
                    fileSizeBytes = file.length(),
                    latitude = location?.latitude,
                    longitude = location?.longitude,
                    gpsAccuracy = location?.accuracy,
                    takenAt = System.currentTimeMillis(),
                    uploadStatus = UploadStatus.PENDING,
                    deviceMetaJson = buildDeviceMeta(),
                )

                photoDao.insert(photo)
                Timber.d("Photo saved locally: ${photo.id} (${file.length()} bytes)")

                workManager.enqueueUniqueWork(
                    SyncWorker.WORK_NAME,
                    ExistingWorkPolicy.KEEP,
                    SyncWorker.buildRequest(),
                )
            } catch (e: Exception) {
                Timber.e(e, "Failed to save photo")
            }
        }
    }

    private fun buildDeviceMeta(): String =
        """{"manufacturer":"${Build.MANUFACTURER}","model":"${Build.MODEL}","sdk":${Build.VERSION.SDK_INT}}"""
}
