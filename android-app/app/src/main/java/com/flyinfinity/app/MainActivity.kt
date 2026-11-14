package com.flyinfinity.app

import android.content.Intent
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

private const val SITE_ROOT = "https://flyinfinitydao.github.io/fit-price-display/"
private const val SITE_HOST = "flyinfinitydao.github.io"
private const val SITE_PATH = "/fit-price-display"

private val FlyGold = Color(0xFFD4AF37)
private val FlyTeal = Color(0xFF00C896)
private val FlyBlack = Color(0xFF0F0F0F)
private val FlySurface = Color(0xFF121A17)

private val FlyColorScheme = darkColorScheme(
    primary = FlyGold,
    onPrimary = FlyBlack,
    secondary = FlyTeal,
    onSecondary = FlyBlack,
    background = FlyBlack,
    onBackground = Color(0xFFF5F5F5),
    surface = FlySurface,
    onSurface = Color(0xFFF5F5F5),
    surfaceVariant = Color(0xFF1B2823),
    onSurfaceVariant = Color(0xFFCAD6D0)
)

private enum class AppDestination(val label: String, val path: String) {
    Dashboard("Home", ""),
    DApp("DApp", "dapp.html"),
    Games("Games", "games/"),
    FlyAI("Fly AI", "fly-ai/")
}

private fun isFlyInfinityUrl(uri: Uri): Boolean {
    val path = uri.path.orEmpty()
    return uri.scheme == "https" &&
        uri.host == SITE_HOST &&
        (path == SITE_PATH || path.startsWith("$SITE_PATH/"))
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = AndroidColor.rgb(15, 15, 15)
        window.navigationBarColor = AndroidColor.rgb(15, 15, 15)
        setContent {
            MaterialTheme(colorScheme = FlyColorScheme) {
                FlyInfinityApp()
            }
        }
    }
}

@Composable
private fun FlyInfinityApp() {
    val context = LocalContext.current
    var destination by remember { mutableStateOf(AppDestination.Dashboard) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var hasLoadError by remember { mutableStateOf(false) }
    var currentUrl by remember { mutableStateOf(SITE_ROOT) }

    fun openDestination(target: AppDestination) {
        destination = target
        currentUrl = SITE_ROOT + target.path
        hasLoadError = false
        isLoading = true
        webView?.loadUrl(currentUrl)
    }

    fun openExternal(uri: Uri): Boolean {
        val allowedSchemes = setOf(
            "https", "http", "wc", "metamask", "trust", "tokenpocket",
            "tpoutside", "imtoken", "safepal", "okx", "binance", "mailto", "tel"
        )
        if (uri.scheme !in allowedSchemes) return true
        return try {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
            )
            true
        } catch (_: Exception) {
            true
        }
    }

    BackHandler(enabled = webView?.canGoBack() == true) {
        webView?.goBack()
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "FLY INFINITY",
                    color = FlyGold,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleLarge
                )
                Text(
                    "BNB SMART CHAIN",
                    color = FlyTeal,
                    style = MaterialTheme.typography.labelSmall
                )
            }

            Box(modifier = Modifier.weight(1f)) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { viewContext ->
                        WebView(viewContext).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.databaseEnabled = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = true
                            settings.mixedContentMode =
                                android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

                            webViewClient = object : WebViewClient() {
                                override fun onPageStarted(
                                    view: WebView,
                                    url: String?,
                                    favicon: android.graphics.Bitmap?
                                ) {
                                    super.onPageStarted(view, url, favicon)
                                    if (!url.isNullOrBlank() && isFlyInfinityUrl(Uri.parse(url))) {
                                        currentUrl = url
                                    }
                                    hasLoadError = false
                                    isLoading = true
                                }

                                override fun onPageFinished(view: WebView, url: String?) {
                                    super.onPageFinished(view, url)
                                    isLoading = false
                                }

                                override fun onReceivedError(
                                    view: WebView,
                                    request: WebResourceRequest,
                                    error: android.webkit.WebResourceError
                                ) {
                                    super.onReceivedError(view, request, error)
                                    if (request.isForMainFrame) {
                                        hasLoadError = true
                                        isLoading = false
                                    }
                                }

                                override fun shouldOverrideUrlLoading(
                                    view: WebView,
                                    request: WebResourceRequest
                                ): Boolean {
                                    val uri = request.url
                                    if (isFlyInfinityUrl(uri)) return false
                                    return openExternal(uri)
                                }
                            }

                            webChromeClient = object : WebChromeClient() {
                                override fun onProgressChanged(view: WebView, newProgress: Int) {
                                    isLoading = newProgress < 100
                                }
                            }

                            webView = this
                            loadUrl(SITE_ROOT)
                        }
                    },
                    update = { webView = it }
                )

                if (isLoading && !hasLoadError) {
                    LinearProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter),
                        color = FlyTeal,
                        trackColor = Color.Transparent
                    )
                }

                if (hasLoadError) {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = FlyBlack.copy(alpha = 0.96f)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(28.dp),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                "Connection unavailable",
                                color = FlyGold,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "Live features need an internet connection. Please reconnect and try again.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(top = 12.dp, bottom = 22.dp)
                            )
                            Button(
                                onClick = {
                                    hasLoadError = false
                                    isLoading = true
                                    webView?.loadUrl(currentUrl)
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = FlyGold,
                                    contentColor = FlyBlack
                                )
                            ) {
                                Text("Retry", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            NavigationBar(containerColor = FlySurface) {
                AppDestination.entries.forEach { item ->
                    NavigationBarItem(
                        selected = destination == item,
                        onClick = { openDestination(item) },
                        icon = {
                            when (item) {
                                AppDestination.Dashboard ->
                                    androidx.compose.material3.Icon(
                                        Icons.Filled.Home,
                                        contentDescription = item.label
                                    )
                                AppDestination.DApp ->
                                    androidx.compose.material3.Icon(
                                        Icons.Filled.SwapHoriz,
                                        contentDescription = item.label
                                    )
                                AppDestination.Games ->
                                    androidx.compose.material3.Icon(
                                        Icons.Filled.Casino,
                                        contentDescription = item.label
                                    )
                                AppDestination.FlyAI ->
                                    androidx.compose.material3.Icon(
                                        Icons.Filled.SmartToy,
                                        contentDescription = item.label
                                    )
                            }
                        },
                        label = { Text(item.label) }
                    )
                }
            }
        }
    }
}
