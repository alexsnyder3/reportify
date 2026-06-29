package ca.reportify.app.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val error: ApiError?,
)

@JsonClass(generateAdapter = true)
data class ApiError(val message: String, val code: String?)

@JsonClass(generateAdapter = true)
data class LoginRequest(val email: String, val password: String)

@JsonClass(generateAdapter = true)
data class LoginData(
    val token: String,
    val user: UserDto,
)

@JsonClass(generateAdapter = true)
data class UserDto(
    val id: String,
    val email: String,
    @Json(name = "firstName") val firstName: String,
    @Json(name = "lastName") val lastName: String,
    val role: String,
    val organization: OrgDto,
)

@JsonClass(generateAdapter = true)
data class OrgDto(val id: String, val name: String, val slug: String)

@JsonClass(generateAdapter = true)
data class JobDto(
    val id: String,
    val name: String,
    val address: String?,
    val latitude: Double?,
    val longitude: Double?,
    @Json(name = "radiusMeters") val radiusMeters: Double,
    @Json(name = "isActive") val isActive: Boolean,
)

@JsonClass(generateAdapter = true)
data class UploadAudioResponse(
    @Json(name = "entryId") val entryId: String,
    val status: String,
)

@JsonClass(generateAdapter = true)
data class UploadPhotoResponse(
    @Json(name = "photoId") val photoId: String,
    val status: String,
)
