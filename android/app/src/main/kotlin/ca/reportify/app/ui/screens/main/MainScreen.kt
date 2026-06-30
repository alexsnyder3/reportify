package ca.reportify.app.ui.screens.main

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun MainScreen(
    onNavigateToCamera: () -> Unit,
    onNavigateToQueue: () -> Unit,
    onNavigateToSettings: () -> Unit,
    viewModel: MainViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    val micPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) viewModel.startRecording()
        else viewModel.setError("Microphone permission is required to record")
    }

    val pulseAnim = rememberInfiniteTransition(label = "pulse")
    val pulseScale by pulseAnim.animateFloat(
        initialValue = 1f,
        targetValue = if (state.isRecording) 1.08f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = EaseInOut),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulse_scale",
    )

    val recordButtonColor by animateColorAsState(
        targetValue = if (state.isRecording) Color(0xFFDC2626) else Color(0xFF2563EB),
        label = "record_color",
    )

    Scaffold(
        containerColor = Color(0xFF111827),
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = "Reportify",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                    )
                    if (state.currentUserName.isNotEmpty()) {
                        Text(
                            text = state.currentUserName,
                            color = Color(0xFF9CA3AF),
                            fontSize = 13.sp,
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(onClick = onNavigateToQueue) {
                        BadgedBox(
                            badge = {
                                val total = state.pendingEntries + state.pendingPhotos
                                if (total > 0) Badge { Text("$total") }
                            }
                        ) {
                            Icon(Icons.Default.CloudUpload, contentDescription = "Queue", tint = Color.White)
                        }
                    }
                    IconButton(onClick = onNavigateToSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.White)
                    }
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Status cards
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                StatusCard(
                    modifier = Modifier.weight(1f),
                    icon = if (state.isOnline) Icons.Default.Wifi else Icons.Default.WifiOff,
                    label = if (state.isOnline) "Online" else "Offline",
                    color = if (state.isOnline) Color(0xFF10B981) else Color(0xFFF59E0B),
                )
                StatusCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.CloudUpload,
                    label = run {
                        val total = state.pendingEntries + state.pendingPhotos
                        if (total == 0) "All synced" else "$total pending"
                    },
                    color = if (state.pendingEntries + state.pendingPhotos == 0) Color(0xFF10B981) else Color(0xFFF59E0B),
                )
            }

            Spacer(Modifier.height(12.dp))

            // Job detection card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937)),
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = if (state.detectedJobName != null) Color(0xFF3B82F6) else Color(0xFF6B7280),
                    )
                    Column {
                        Text(
                            text = "Detected Job",
                            color = Color(0xFF9CA3AF),
                            fontSize = 11.sp,
                        )
                        Text(
                            text = state.detectedJobName ?: "No job detected at this location",
                            color = if (state.detectedJobName != null) Color.White else Color(0xFF6B7280),
                            fontWeight = if (state.detectedJobName != null) FontWeight.SemiBold else FontWeight.Normal,
                            fontSize = 14.sp,
                        )
                    }
                }
            }

            Spacer(Modifier.weight(1f))

            // Last recording feedback
            if (state.lastRecordingDuration != null) {
                Text(
                    text = "✓ ${state.lastRecordingDuration}",
                    color = Color(0xFF10B981),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                )
                Spacer(Modifier.height(16.dp))
            }

            // MAIN RECORD BUTTON
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(220.dp)
                    .scale(pulseScale),
            ) {
                // Outer ring when recording
                if (state.isRecording) {
                    Box(
                        modifier = Modifier
                            .size(220.dp)
                            .clip(CircleShape)
                            .background(Color(0x33DC2626)),
                    )
                }
                Button(
                    onClick = {
                        if (state.isRecording) viewModel.stopRecording()
                        else micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    },
                    modifier = Modifier.size(180.dp),
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(containerColor = recordButtonColor),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = if (state.isRecording) Icons.Default.Stop else Icons.Default.Mic,
                            contentDescription = if (state.isRecording) "Stop" else "Record",
                            modifier = Modifier.size(52.dp),
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = if (state.isRecording) "STOP" else "RECORD",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 2.sp,
                        )
                    }
                }
            }

            if (state.isRecording) {
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Recording… tap to stop",
                    color = Color(0xFFF87171),
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                )
            }

            Spacer(Modifier.weight(1f))

            // Take Photo button
            OutlinedButton(
                onClick = onNavigateToCamera,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp),
                shape = RoundedCornerShape(16.dp),
                enabled = !state.isRecording,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = BorderStroke(1.5.dp, Color(0xFF374151)),
            ) {
                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                Text("Take Photo", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(Modifier.height(16.dp))

            // Error
            state.error?.let { error ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF7F1D1D)),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.Error, contentDescription = null, tint = Color(0xFFF87171))
                        Text(error, color = Color.White, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        TextButton(onClick = viewModel::clearError) {
                            Text("Dismiss", color = Color(0xFFF87171))
                        }
                    }
                }
            }

            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

@Composable
private fun StatusCard(
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: Color,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937)),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}
