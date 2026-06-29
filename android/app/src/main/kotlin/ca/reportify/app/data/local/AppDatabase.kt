package ca.reportify.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import ca.reportify.app.data.local.dao.EntryDao
import ca.reportify.app.data.local.dao.PhotoDao
import ca.reportify.app.data.local.entities.EntryEntity
import ca.reportify.app.data.local.entities.PhotoEntity

@Database(
    entities = [EntryEntity::class, PhotoEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun entryDao(): EntryDao
    abstract fun photoDao(): PhotoDao
}
