package ca.reportify.app.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "photos")
data class PhotoEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val organizationId: String,
    val filePath: String,
    val thumbnailPath: String?,
    val mimeType: String,
    val fileSizeBytes: Long,
    val latitude: Double?,
    val longitude: Double?,
    val gpsAccuracy: Float?,
    val takenAt: Long, // unix millis
    val linkedEntryId: String? = null, // local entry ID if linked
    val uploadStatus: UploadStatus = UploadStatus.PENDING,
    val uploadAttempts: Int = 0,
    val uploadError: String? = null,
    val serverPhotoId: String? = null,
    val deviceMetaJson: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)
