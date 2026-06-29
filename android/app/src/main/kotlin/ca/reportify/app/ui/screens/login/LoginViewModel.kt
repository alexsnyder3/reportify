package ca.reportify.app.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ca.reportify.app.data.remote.api.ReportifyApi
import ca.reportify.app.data.remote.dto.LoginRequest
import ca.reportify.app.utils.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false,
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val api: ReportifyApi,
    private val session: SessionManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onEmailChange(v: String) = _uiState.update { it.copy(email = v, error = null) }
    fun onPasswordChange(v: String) = _uiState.update { it.copy(password = v, error = null) }

    fun login() {
        val email = _uiState.value.email.trim()
        val password = _uiState.value.password

        if (email.isEmpty() || password.isEmpty()) {
            _uiState.update { it.copy(error = "Email and password are required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = api.login(LoginRequest(email, password))
                if (response.success && response.data != null) {
                    val data = response.data
                    session.saveSession(
                        token = data.token,
                        userId = data.user.id,
                        orgId = data.user.organization.id,
                        firstName = data.user.firstName,
                        lastName = data.user.lastName,
                        email = data.user.email,
                        role = data.user.role,
                    )
                    _uiState.update { it.copy(isLoggedIn = true) }
                } else {
                    _uiState.update { it.copy(error = response.error?.message ?: "Login failed") }
                }
            } catch (e: Exception) {
                Timber.e(e, "Login error")
                _uiState.update { it.copy(error = "Connection failed. Check your internet connection.") }
            } finally {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }
}
