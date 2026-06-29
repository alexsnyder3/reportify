package ca.reportify.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ca.reportify.app.ui.screens.login.LoginScreen
import ca.reportify.app.ui.screens.main.MainScreen
import ca.reportify.app.ui.screens.queue.QueueScreen
import ca.reportify.app.ui.screens.settings.SettingsScreen
import ca.reportify.app.utils.SessionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.firstOrNull
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

                // Camera screen placeholder — implement with CameraX in follow-up
                composable("camera") {
                    CameraPlaceholderScreen(onBack = { navController.popBackStack() })
                }
            }
        }
    }
}

// Placeholder camera screen — full CameraX implementation in camera branch
@Composable
private fun CameraPlaceholderScreen(onBack: () -> Unit) {
    androidx.compose.material3.Scaffold(
        containerColor = androidx.compose.ui.graphics.Color.Black,
        topBar = {
            androidx.compose.material3.IconButton(onClick = onBack) {
                androidx.compose.material3.Icon(
                    androidx.compose.material.icons.Icons.Default.ArrowBack,
                    contentDescription = "Back",
                    tint = androidx.compose.ui.graphics.Color.White,
                )
            }
        }
    ) { padding ->
        androidx.compose.foundation.layout.Box(
            modifier = androidx.compose.ui.Modifier.fillMaxSize().padding(padding),
            contentAlignment = androidx.compose.ui.Alignment.Center,
        ) {
            androidx.compose.material3.Text(
                "Camera — tap back to return\nFull CameraX implementation in next release",
                color = androidx.compose.ui.graphics.Color.White,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}
