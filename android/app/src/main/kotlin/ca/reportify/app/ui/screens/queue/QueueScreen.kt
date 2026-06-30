package ca.reportify.app.ui.screens.queue

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ca.reportify.app.data.local.entities.UploadStatus
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun QueueScreen(
    onBack: () -> Unit,
    viewModel: QueueViewModel = hiltViewModel(),
) {
    val entries by viewModel.entries.collectAsState(initial = emptyList())
    val photos by viewModel.photos.collectAsState(initial = emptyList())
    val fmt = remember { SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()) }

    Scaffold(
        containerColor = Color(0xFF111827),
        topBar = {
            Row(
                modifier = Modifier.statusBarsPadding().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
                Text("Upload Queue", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (entries.isEmpty() && photos.isEmpty()) {
                item {
                    Box(modifier = Modifier.fillParentMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF10B981), modifier = Modifier.size(56.dp))
                            Spacer(Modifier.height(12.dp))
                            Text("All synced!", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                            Text("Nothing waiting to upload", color = Color(0xFF9CA3AF), fontSize = 14.sp)
                        }
                    }
                }
            }

            if (entries.isNotEmpty()) {
                item {
                    Text("Voice Recordings (${entries.size})", color = Color(0xFF9CA3AF), fontSize = 13.sp, modifier = Modifier.padding(bottom = 4.dp))
                }
                items(entries) { entry ->
                    QueueItemCard(
                        title = "Voice Recording",
                        subtitle = fmt.format(Date(entry.recordedAt)),
                        status = entry.uploadStatus,
                        error = entry.uploadError,
                        attempts = entry.uploadAttempts,
                    )
                }
            }

            if (photos.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text("Photos (${photos.size})", color = Color(0xFF9CA3AF), fontSize = 13.sp, modifier = Modifier.padding(bottom = 4.dp))
                }
                items(photos) { photo ->
                    QueueItemCard(
                        title = "Photo",
                        subtitle = fmt.format(Date(photo.takenAt)),
                        status = photo.uploadStatus,
                        error = photo.uploadError,
                        attempts = photo.uploadAttempts,
                    )
                }
            }

            item {
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = viewModel::triggerSync,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                ) {
                    Icon(Icons.Default.Sync, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Sync Now", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun QueueItemCard(
    title: String,
    subtitle: String,
    status: UploadStatus,
    error: String?,
    attempts: Int,
) {
    val (statusColor, statusText, icon) = when (status) {
        UploadStatus.PENDING -> Triple(Color(0xFFF59E0B), "Waiting", Icons.Default.Schedule)
        UploadStatus.UPLOADING -> Triple(Color(0xFF3B82F6), "Uploading…", Icons.Default.CloudUpload)
        UploadStatus.UPLOADED -> Triple(Color(0xFF10B981), "Uploaded", Icons.Default.CheckCircle)
        UploadStatus.FAILED -> Triple(Color(0xFFEF4444), "Failed", Icons.Default.Error)
    }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937)),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = statusColor, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = Color.White, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Text(subtitle, color = Color(0xFF9CA3AF), fontSize = 12.sp)
                if (error != null && status == UploadStatus.FAILED) {
                    Text("Error: $error", color = Color(0xFFFCA5A5), fontSize = 11.sp)
                }
                if (attempts > 0) {
                    Text("Attempts: $attempts", color = Color(0xFF6B7280), fontSize = 11.sp)
                }
            }
            Text(statusText, color = statusColor, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
    }
}
