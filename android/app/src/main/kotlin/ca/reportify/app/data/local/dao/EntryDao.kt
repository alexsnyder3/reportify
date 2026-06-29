package ca.reportify.app.data.local.dao

import androidx.room.*
import ca.reportify.app.data.local.entities.EntryEntity
import ca.reportify.app.data.local.entities.UploadStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface EntryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entry: EntryEntity)

    @Update
    suspend fun update(entry: EntryEntity)

    @Query("SELECT * FROM entries ORDER BY createdAt DESC")
    fun getAllFlow(): Flow<List<EntryEntity>>

    @Query("SELECT * FROM entries WHERE uploadStatus IN ('PENDING', 'FAILED') ORDER BY createdAt ASC")
    suspend fun getPendingUploads(): List<EntryEntity>

    @Query("SELECT * FROM entries WHERE id = :id")
    suspend fun getById(id: String): EntryEntity?

    @Query("UPDATE entries SET uploadStatus = :status, uploadAttempts = uploadAttempts + 1, uploadError = :error WHERE id = :id")
    suspend fun updateStatus(id: String, status: UploadStatus, error: String? = null)

    @Query("UPDATE entries SET uploadStatus = 'UPLOADED', serverEntryId = :serverId WHERE id = :id")
    suspend fun markUploaded(id: String, serverId: String)

    @Query("SELECT COUNT(*) FROM entries WHERE uploadStatus = 'PENDING' OR uploadStatus = 'FAILED'")
    fun getPendingCountFlow(): Flow<Int>
}
