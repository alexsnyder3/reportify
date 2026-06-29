package ca.reportify.app.data.remote.api

import ca.reportify.app.data.remote.dto.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.*

interface ReportifyApi {

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): ApiResponse<LoginData>

    @GET("api/auth/me")
    suspend fun getMe(): ApiResponse<UserDto>

    @GET("api/jobs")
    suspend fun getJobs(): ApiResponse<List<JobDto>>

    @Multipart
    @POST("api/upload/audio")
    suspend fun uploadAudio(
        @Part audio: MultipartBody.Part,
        @Part("recordedAt") recordedAt: RequestBody,
        @Part("durationSeconds") durationSeconds: RequestBody?,
        @Part("latitude") latitude: RequestBody?,
        @Part("longitude") longitude: RequestBody?,
        @Part("gpsAccuracy") gpsAccuracy: RequestBody?,
        @Part("deviceEntryId") deviceEntryId: RequestBody?,
        @Part("deviceMeta") deviceMeta: RequestBody?,
    ): ApiResponse<UploadAudioResponse>

    @Multipart
    @POST("api/upload/photo")
    suspend fun uploadPhoto(
        @Part photo: MultipartBody.Part,
        @Part("takenAt") takenAt: RequestBody,
        @Part("latitude") latitude: RequestBody?,
        @Part("longitude") longitude: RequestBody?,
        @Part("gpsAccuracy") gpsAccuracy: RequestBody?,
        @Part("devicePhotoId") devicePhotoId: RequestBody?,
        @Part("deviceMeta") deviceMeta: RequestBody?,
    ): ApiResponse<UploadPhotoResponse>
}
