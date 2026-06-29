package ca.reportify.app.utils

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "reportify_session")

@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val TOKEN = stringPreferencesKey("jwt_token")
    private val USER_ID = stringPreferencesKey("user_id")
    private val ORG_ID = stringPreferencesKey("org_id")
    private val USER_NAME = stringPreferencesKey("user_name")
    private val USER_EMAIL = stringPreferencesKey("user_email")
    private val USER_ROLE = stringPreferencesKey("user_role")

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[TOKEN] }
    val userIdFlow: Flow<String?> = context.dataStore.data.map { it[USER_ID] }
    val orgIdFlow: Flow<String?> = context.dataStore.data.map { it[ORG_ID] }
    val userNameFlow: Flow<String?> = context.dataStore.data.map { it[USER_NAME] }

    suspend fun getToken(): String? = tokenFlow.firstOrNull()
    suspend fun getUserId(): String? = userIdFlow.firstOrNull()
    suspend fun getOrgId(): String? = orgIdFlow.firstOrNull()

    suspend fun saveSession(
        token: String,
        userId: String,
        orgId: String,
        firstName: String,
        lastName: String,
        email: String,
        role: String,
    ) {
        context.dataStore.edit { prefs ->
            prefs[TOKEN] = token
            prefs[USER_ID] = userId
            prefs[ORG_ID] = orgId
            prefs[USER_NAME] = "$firstName $lastName"
            prefs[USER_EMAIL] = email
            prefs[USER_ROLE] = role
        }
    }

    suspend fun clearSession() {
        context.dataStore.edit { it.clear() }
    }

    fun isLoggedInFlow(): Flow<Boolean> = tokenFlow.map { it != null }
}
