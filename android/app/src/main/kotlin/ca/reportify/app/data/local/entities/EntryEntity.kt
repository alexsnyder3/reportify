package ca.reportify.app.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class UploadStatus { PENDING, UPLOADING, UPLOADED, FAILED }

@Entity(tableName = "entries")
data class EntryEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val organizationId: String,
    val audioFilePath: String,
    val durationSeconds: Float?,
    val latitude: Double?,
    val longitude: Double?,
    val gpsAccuracy: Float?,
    val recordedAt: Long, // unix millis
    val uploadStatus: UploadStatus = UploadStatus.PENDING,
    val uploadAttempts: Int = 0,
    val uploadError: String? = null,
    val serverEntryId: String? = null, // set after successful upload
    val deviceMetaJson: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
)
