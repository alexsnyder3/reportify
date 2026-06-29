package ca.reportify.app.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.ExistingWorkPolicy
import androidx.work.WorkManager
import ca.reportify.app.utils.SessionManager
import ca.reportify.app.workers.SyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val userName: String = "",
    val userEmail: String = "",
    val userRole: String = "",
    val isLoggedOut: Boolean = false,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val session: SessionManager,
    private val workManager: WorkManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            session.userNameFlow.collect { name ->
                _uiState.update { it.copy(userName = name ?: "") }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            session.clearSession()
            _uiState.update { it.copy(isLoggedOut = true) }
        }
    }

    fun syncNow() {
        workManager.enqueueUniqueWork(
            SyncWorker.WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            SyncWorker.buildRequest(),
        )
    }
}
