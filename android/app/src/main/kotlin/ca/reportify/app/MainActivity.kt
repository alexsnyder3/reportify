package ca.reportify.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ca.reportify.app.ui.screens.camera.CameraScreen
import ca.reportify.app.ui.screens.login.LoginScreen
import ca.reportify.app.ui.screens.main.MainScreen
import ca.reportify.app.ui.screens.queue.QueueScreen
import ca.reportify.app.ui.screens.settings.SettingsScreen
import ca.reportify.app.utils.SessionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.runBlocking
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var session: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val isLoggedIn = runBlocking { session.getToken() != null }

        setContent {
            val navController = rememberNavController()
            val startDest = if (isLoggedIn) "main" else "login"

            NavHost(navController = navController, startDestination = startDest) {
                composable("login") {
                    LoginScreen(
                        onLoginSuccess = {
                            navController.navigate("main") {
                                popUpTo("login") { inclusive = true }
                            }
                        }
                    )
                }

                composable("main") {
                    MainScreen(
                        onNavigateToCamera = { navController.navigate("camera") },
                        onNavigateToQueue = { navController.navigate("queue") },
                        onNavigateToSettings = { navController.navigate("settings") },
                    )
                }

                composable("queue") {
                    QueueScreen(onBack = { navController.popBackStack() })
                }

                composable("settings") {
                    SettingsScreen(
                        onBack = { navController.popBackStack() },
                        onLogout = {
                            navController.navigate("login") {
                                popUpTo(0) { inclusive = true }
                            }
                        },
                    )
                }

                composable("camera") {
                    CameraScreen(onBack = { navController.popBackStack() })
                }
            }
        }
    }
}
