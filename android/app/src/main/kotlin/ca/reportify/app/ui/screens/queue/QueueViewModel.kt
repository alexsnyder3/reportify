package ca.reportify.app.ui.screens.queue

import androidx.lifecycle.ViewModel
import androidx.work.ExistingWorkPolicy
import androidx.work.WorkManager
import ca.reportify.app.data.local.dao.EntryDao
import ca.reportify.app.data.local.dao.PhotoDao
import ca.reportify.app.data.local.entities.EntryEntity
import ca.reportify.app.data.local.entities.PhotoEntity
import ca.reportify.app.data.local.entities.UploadStatus
import ca.reportify.app.workers.SyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

@HiltViewModel
class QueueViewModel @Inject constructor(
    private val entryDao: EntryDao,
    private val photoDao: PhotoDao,
    private val workManager: WorkManager,
) : ViewModel() {

    val entries: Flow<List<EntryEntity>> = entryDao.getAllFlow().map { list ->
        list.filter { it.uploadStatus != UploadStatus.UPLOADED }
    }

    val photos: Flow<List<PhotoEntity>> = photoDao.getAllFlow().map { list ->
        list.filter { it.uploadStatus != UploadStatus.UPLOADED }
    }

    fun triggerSync() {
        workManager.enqueueUniqueWork(
            SyncWorker.WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            SyncWorker.buildRequest(),
        )
    }
}
