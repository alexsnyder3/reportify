package ca.reportify.app.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ca.reportify.app.BuildConfig

@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.isLoggedOut) {
        if (state.isLoggedOut) onLogout()
    }

    Scaffold(
        containerColor = Color(0xFF111827),
        topBar = {
            Row(
                modifier = Modifier.statusBarsPadding().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
                Text("Settings", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // User info
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937)),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier.size(48.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFF2563EB)) {
                            Box(modifier = Modifier.size(48.dp), contentAlignment = Alignment.Center) {
                                Text(
                                    state.userName.firstOrNull()?.toString() ?: "U",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp,
                                )
                            }
                        }
                    }
                    Column {
                        Text(state.userName, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        Text(state.userEmail, color = Color(0xFF9CA3AF), fontSize = 13.sp)
                        Text(state.userRole, color = Color(0xFF6B7280), fontSize = 12.sp)
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            Text("ACCOUNT", color = Color(0xFF6B7280), fontSize = 11.sp, letterSpacing = 1.sp)

            SettingsRow(Icons.Default.Sync, "Sync all pending uploads") { viewModel.syncNow() }
            SettingsRow(Icons.Default.Info, "App version ${BuildConfig.VERSION_NAME}") {}

            Spacer(Modifier.weight(1f))

            // Logout
            Button(
                onClick = viewModel::logout,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7F1D1D)),
            ) {
                Icon(Icons.Default.Logout, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Sign Out", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }

            navigationBarsPadding()
        }
    }
}

@Composable
private fun SettingsRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937)),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFF9CA3AF), modifier = Modifier.size(20.dp))
            Text(label, color = Color.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
            Icon(Icons.Default.ChevronRight, null, tint = Color(0xFF4B5563), modifier = Modifier.size(18.dp))
        }
    }
}
