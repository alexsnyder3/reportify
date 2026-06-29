package ca.reportify.app.di

import android.content.Context
import androidx.room.Room
import androidx.work.WorkManager
import ca.reportify.app.BuildConfig
import ca.reportify.app.data.local.AppDatabase
import ca.reportify.app.data.local.dao.EntryDao
import ca.reportify.app.data.local.dao.PhotoDao
import ca.reportify.app.data.remote.api.ReportifyApi
import ca.reportify.app.utils.SessionManager
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    @Provides @Singleton
    fun provideOkHttp(sessionManager: SessionManager): OkHttpClient {
        val authInterceptor = Interceptor { chain ->
            val token = runBlocking { sessionManager.getToken() }
            val req = if (token != null) {
                chain.request().newBuilder().header("Authorization", "Bearer $token").build()
            } else chain.request()
            chain.proceed(req)
        }

        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                        else HttpLoggingInterceptor.Level.NONE
            })
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
            .build()
    }

    @Provides @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    @Provides @Singleton
    fun provideApi(retrofit: Retrofit): ReportifyApi = retrofit.create(ReportifyApi::class.java)

    @Provides @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): AppDatabase =
        Room.databaseBuilder(ctx, AppDatabase::class.java, "reportify.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideEntryDao(db: AppDatabase): EntryDao = db.entryDao()
    @Provides fun providePhotoDao(db: AppDatabase): PhotoDao = db.photoDao()

    @Provides @Singleton
    fun provideWorkManager(@ApplicationContext ctx: Context): WorkManager = WorkManager.getInstance(ctx)
}
