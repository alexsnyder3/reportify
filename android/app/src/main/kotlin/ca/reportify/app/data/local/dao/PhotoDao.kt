package ca.reportify.app.data.local.dao

import androidx.room.*
import ca.reportify.app.data.local.entities.PhotoEntity
import ca.reportify.app.data.local.entities.UploadStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface PhotoDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(photo: PhotoEntity)

    @Update
    suspend fun update(photo: PhotoEntity)

    @Query("SELECT * FROM photos ORDER BY createdAt DESC")
    fun getAllFlow(): Flow<List<PhotoEntity>>

    @Query("SELECT * FROM photos WHERE uploadStatus IN ('PENDING', 'FAILED') ORDER BY createdAt ASC")
    suspend fun getPendingUploads(): List<PhotoEntity>

    @Query("SELECT * FROM photos WHERE id = :id")
    suspend fun getById(id: String): PhotoEntity?

    @Query("UPDATE photos SET uploadStatus = :status, uploadAttempts = uploadAttempts + 1, uploadError = :error WHERE id = :id")
    suspend fun updateStatus(id: String, status: UploadStatus, error: String? = null)

    @Query("UPDATE photos SET uploadStatus = 'UPLOADED', serverPhotoId = :serverId WHERE id = :id")
    suspend fun markUploaded(id: String, serverId: String)

    @Query("SELECT COUNT(*) FROM photos WHERE uploadStatus = 'PENDING' OR uploadStatus = 'FAILED'")
    fun getPendingCountFlow(): Flow<Int>
}
