package ca.reportify.app.utils

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import com.google.android.gms.location.*
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

@Singleton
class LocationProvider @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val client: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission")
    suspend fun getLastLocation(): LocationResult? {
        return try {
            suspendCancellableCoroutine { cont ->
                client.getCurrentLocation(
                    Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                    null,
                ).addOnSuccessListener { loc: Location? ->
                    cont.resume(
                        loc?.let { LocationResult(it.latitude, it.longitude, it.accuracy) }
                    )
                }.addOnFailureListener { e ->
                    Timber.w(e, "Location fetch failed")
                    cont.resume(null)
                }
            }
        } catch (e: Exception) {
            Timber.w(e, "Location unavailable")
            null
        }
    }

    data class LocationResult(
        val latitude: Double,
        val longitude: Double,
        val accuracy: Float,
    )
}
