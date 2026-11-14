package com.flyinfinity.app

import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Color as AndroidColor
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ValueCallback
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
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
import androidx.compose.runtime.DisposableEffect
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

private fun hasValidatedInternet(context: Context): Boolean {
    val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        ?: return false
    val network = manager.activeNetwork ?: return false
    val capabilities = manager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}

private fun applyWebCachePolicy(webView: WebView, context: Context) {
    webView.settings.cacheMode = if (hasValidatedInternet(context)) {
        android.webkit.WebSettings.LOAD_DEFAULT
    } else {
        android.webkit.WebSettings.LOAD_CACHE_ELSE_NETWORK
    }
}


/**
 * Keeps the site's existing per-page language JSON files in the app's private
 * cache. The website's language manager and dictionaries remain untouched.
 */

/**
 * Persists dashboard JSON feeds and the rendered numeric dashboard values.
 * This is app-only: the hosted website and its scripts are not modified.
 */
private class DashboardDataCache(private val context: Context) {
    private val directory = File(context.filesDir, "fly-dashboard-data").apply { mkdirs() }

    private fun cacheFile(path: String): File {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(path.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return File(directory, "$digest.json")
    }

    private fun download(url: String): ByteArray? {
        val connection = (URL(url).openConnection() as? HttpURLConnection) ?: return null
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 7000
            connection.readTimeout = 10000
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode in 200..299) {
                connection.inputStream.use { it.readBytes() }
            } else null
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun response(bytes: ByteArray) = WebResourceResponse(
        "application/json",
        "UTF-8",
        200,
        "OK",
        mapOf(
            "Content-Type" to "application/json; charset=utf-8",
            "Cache-Control" to "no-store"
        ),
        bytes.inputStream()
    )

    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        if (request.method != "GET") return null
        val uri = request.url
        if (uri.scheme != "https" || uri.host != SITE_HOST) return null
        val path = uri.path.orEmpty()
        if (path !in setOf("$SITE_PATH/price-history.json", "$SITE_PATH/trading-volume.json")) {
            return null
        }

        val file = cacheFile(path)
        if (hasValidatedInternet(context)) {
            val cleanUrl = uri.buildUpon().clearQuery().build().toString()
            download(cleanUrl)?.let { bytes ->
                runCatching { file.writeBytes(bytes) }
                return response(bytes)
            }
        }
        return if (file.isFile) runCatching { response(file.readBytes()) }.getOrNull() else null
    }
}

private const val DASHBOARD_SNAPSHOT_SCRIPT = """
(function() {
  try {
    var key = 'flyInfinityDashboardNumbersV1';
    var online = __FLY_ONLINE__;
    var ids = /price|supply|balance|volume|liquid|airdrop|holder|owner|token|market|cap|reserve|transaction|count|total|change|stat|circulation/i;
    function restore() {
      try {
        var saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (!saved || !saved.values) return;
        Object.keys(saved.values).forEach(function(id) {
          var el = document.getElementById(id);
          if (el && typeof saved.values[id] === 'string') el.innerHTML = saved.values[id];
        });
        document.documentElement.setAttribute('data-fly-dashboard-cache', 'restored');
      } catch (_) {}
    }
    function save() {
      if (!online) return;
      try {
        var values = {};
        document.querySelectorAll('[id]').forEach(function(el) {
          if (ids.test(el.id) && el.children.length < 8) {
            var value = el.innerHTML;
            if (value && value.trim()) values[el.id] = value;
          }
        });
        if (Object.keys(values).length) {
          localStorage.setItem(key, JSON.stringify({savedAt: Date.now(), values: values}));
        }
      } catch (_) {}
    }
    if (!online) restore();
    save();
    if (window.__flyDashboardCacheObserver) {
      window.__flyDashboardCacheObserver.disconnect();
    }
    window.__flyDashboardCacheObserver = new MutationObserver(function() {
      save();
    });
    window.__flyDashboardCacheObserver.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true
    });
    window.addEventListener('beforeunload', save);
  } catch (_) {}
})();
"""

private class LanguageAssetCache(private val context: Context) {
    private val languages = listOf("en", "fa", "ar", "tr", "ru", "zh", "es", "pt")
    private val directory = File(context.cacheDir, "fly-language-assets").apply { mkdirs() }

    private fun cacheFile(path: String): File {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(path.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return File(directory, "$digest.json")
    }

    private fun download(url: String): ByteArray? {
        val connection = (URL(url).openConnection() as? HttpURLConnection) ?: return null
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 7000
            connection.readTimeout = 10000
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode in 200..299) connection.inputStream.use { it.readBytes() } else null
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun save(path: String, bytes: ByteArray) {
        runCatching {
            val target = cacheFile(path)
            val temporary = File(directory, target.name + ".tmp")
            temporary.writeBytes(bytes)
            if (!temporary.renameTo(target)) {
                target.writeBytes(bytes)
                temporary.delete()
            }
        }
    }

    private fun response(bytes: ByteArray): WebResourceResponse =
        WebResourceResponse(
            "application/json",
            "UTF-8",
            200,
            "OK",
            mapOf(
                "Content-Type" to "application/json; charset=utf-8",
                "Cache-Control" to "public, max-age=31536000"
            ),
            bytes.inputStream()
        )

    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        if (request.method != "GET") return null
        val uri = request.url
        if (uri.scheme != "https" || uri.host != SITE_HOST) return null
        val path = uri.path.orEmpty()
        if (!path.startsWith("$SITE_PATH/lang/") || !path.endsWith(".json")) return null

        val file = cacheFile(path)
        if (hasValidatedInternet(context)) {
            val cleanUrl = uri.buildUpon().clearQuery().build().toString()
            download(cleanUrl)?.let { bytes ->
                save(path, bytes)
                return response(bytes)
            }
        }
        return if (file.isFile) runCatching { response(file.readBytes()) }.getOrNull() else null
    }

    /** Pre-download all eight language dictionaries for the page being viewed. */
    fun prefetchForPage(pageUrl: String) {
        if (!hasValidatedInternet(context)) return
        val uri = runCatching { Uri.parse(pageUrl) }.getOrNull() ?: return
        if (uri.host != SITE_HOST) return
        var page = uri.path.orEmpty().substringAfterLast('/').substringBeforeLast('.', "")
        if (page.isBlank()) page = "index"
        if (page in setOf("dapp-ownership", "dapp-buy-fit", "dapp-sell-fit", "dapp-gift")) page = "dapp"
        val pageName = page
        Thread {
            languages.forEach { language ->
                val path = "$SITE_PATH/lang/$pageName/$language.json"
                val url = "https://$SITE_HOST$path"
                download(url)?.let { save(path, it) }
            }
        }.apply { name = "FlyLanguageCache-$pageName"; isDaemon = true }.start()
    }
}

class MainActivity : ComponentActivity() {
    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null
    private lateinit var filePickerLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        filePickerLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            val callback = pendingFileChooser
            pendingFileChooser = null
            val selectedFiles = if (result.resultCode == Activity.RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            } else {
                null
            }
            callback?.onReceiveValue(selectedFiles)
        }
        // Use one consistent edge-to-edge strategy on every Android version.
        // Compose then applies safe system-bar and display-cutout insets below.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = AndroidColor.rgb(15, 15, 15)
        window.navigationBarColor = AndroidColor.rgb(15, 15, 15)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        setContent {
            MaterialTheme(colorScheme = FlyColorScheme) {
                FlyInfinityApp { callback, params ->
                    pendingFileChooser?.onReceiveValue(null)
                    pendingFileChooser = callback
                    try {
                        filePickerLauncher.launch(params.createIntent())
                        true
                    } catch (_: Exception) {
                        pendingFileChooser = null
                        callback.onReceiveValue(null)
                        false
                    }
                }
            }
        }
    }
}

@Composable
private fun FlyInfinityApp(
    onFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean
) {
    val context = LocalContext.current
    val languageAssetCache = remember(context) { LanguageAssetCache(context) }
    val dashboardDataCache = remember(context) { DashboardDataCache(context) }
    var destination by remember { mutableStateOf(AppDestination.Dashboard) }
    var webView by remember { mutableStateOf<WebView?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var hasLoadError by remember { mutableStateOf(false) }
    var currentUrl by remember { mutableStateOf(SITE_ROOT) }
    var hasInternet by remember { mutableStateOf(hasValidatedInternet(context)) }
    var wasOnline by remember { mutableStateOf(hasInternet) }

    androidx.compose.runtime.LaunchedEffect(hasInternet) {
        if (hasInternet && !wasOnline &&
            (currentUrl == SITE_ROOT || currentUrl.substringBefore('?').endsWith("/index.html"))) {
            webView?.post { webView?.reload() }
        }
        wasOnline = hasInternet
    }
    val connectivityManager = remember(context) {
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    }

    DisposableEffect(connectivityManager) {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) {
                hasInternet = hasValidatedInternet(context)
            }

            override fun onLost(network: android.net.Network) {
                hasInternet = hasValidatedInternet(context)
            }

            override fun onCapabilitiesChanged(
                network: android.net.Network,
                networkCapabilities: NetworkCapabilities
            ) {
                hasInternet = networkCapabilities.hasCapability(
                    NetworkCapabilities.NET_CAPABILITY_INTERNET
                ) && networkCapabilities.hasCapability(
                    NetworkCapabilities.NET_CAPABILITY_VALIDATED
                )
            }
        }
        try {
            connectivityManager.registerNetworkCallback(request, callback)
        } catch (_: Exception) {
            hasInternet = hasValidatedInternet(context)
        }
        onDispose {
            try {
                connectivityManager.unregisterNetworkCallback(callback)
            } catch (_: Exception) {
                // The callback may not have been registered on restricted devices.
            }
        }
    }

    fun openDestination(target: AppDestination) {
        destination = target
        currentUrl = SITE_ROOT + target.path
        hasLoadError = false
        isLoading = true
        webView?.let { applyWebCachePolicy(it, context); it.loadUrl(currentUrl) }
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
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing),
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
                    if (hasInternet) "ONLINE · BNB SMART CHAIN" else "OFFLINE · CACHED CONTENT ONLY",
                    color = if (hasInternet) FlyTeal else FlyGold,
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
                            settings.setSupportMultipleWindows(true)
                            settings.javaScriptCanOpenWindowsAutomatically = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = true
                            settings.mixedContentMode =
                                android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

                            webViewClient = object : WebViewClient() {
                                override fun shouldInterceptRequest(
                                    view: WebView,
                                    request: WebResourceRequest
                                ): WebResourceResponse? {
                                    return dashboardDataCache.intercept(request)
                                        ?: languageAssetCache.intercept(request)
                                        ?: super.shouldInterceptRequest(view, request)
                                }

                                override fun onPageStarted(
                                    view: WebView,
                                    url: String?,
                                    favicon: android.graphics.Bitmap?
                                ) {
                                    super.onPageStarted(view, url, favicon)
                                    if (!url.isNullOrBlank() && isFlyInfinityUrl(Uri.parse(url))) {
                                        currentUrl = url
                                    }
                                    applyWebCachePolicy(view, context)
                                    hasLoadError = false
                                    isLoading = true
                                }

                                override fun onPageFinished(view: WebView, url: String?) {
                                    super.onPageFinished(view, url)
                                    isLoading = false
                                    if (!url.isNullOrBlank()) {
                                        languageAssetCache.prefetchForPage(url)
                                        val pageUri = runCatching { Uri.parse(url) }.getOrNull()
                                        val isDashboard = pageUri?.host == SITE_HOST &&
                                            (pageUri.path == SITE_PATH || pageUri.path == "$SITE_PATH/" ||
                                             pageUri.path == "$SITE_PATH/index.html")
                                        if (isDashboard) {
                                            val onlineLiteral = hasValidatedInternet(context).toString()
                                            val script = DASHBOARD_SNAPSHOT_SCRIPT.replace("__FLY_ONLINE__", onlineLiteral)
                                            view.evaluateJavascript(script, null)
                                        }
                                    }
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

                            setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                                val downloadUri = runCatching { Uri.parse(url) }.getOrNull()
                                if (downloadUri?.scheme != "https") {
                                    Toast.makeText(context, "Only secure HTTPS downloads are allowed", Toast.LENGTH_LONG).show()
                                } else {
                                    val guessedName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                                    val safeName = guessedName
                                        .replace(Regex("[\\\\/:*?\\\"<>|]"), "_")
                                        .take(180)
                                        .ifBlank { "fly-infinity-download" }
                                    try {
                                        val request = DownloadManager.Request(downloadUri)
                                            .setTitle(safeName)
                                            .setDescription("Downloading from Fly Infinity")
                                            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                                            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeName)
                                            .setAllowedOverMetered(true)
                                            .setAllowedOverRoaming(false)
                                        if (!mimeType.isNullOrBlank()) request.setMimeType(mimeType)
                                        if (!userAgent.isNullOrBlank()) request.addRequestHeader("User-Agent", userAgent)
                                        CookieManager.getInstance().getCookie(url)?.let { cookies ->
                                            request.addRequestHeader("Cookie", cookies)
                                        }
                                        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                                        manager.enqueue(request)
                                        Toast.makeText(context, "Download started: $safeName", Toast.LENGTH_LONG).show()
                                    } catch (_: Exception) {
                                        Toast.makeText(context, "Could not start download", Toast.LENGTH_LONG).show()
                                    }
                                }
                            }

                            val hostWebView = this
                            webChromeClient = object : WebChromeClient() {
                                override fun onCreateWindow(
                                    view: WebView?,
                                    isDialog: Boolean,
                                    isUserGesture: Boolean,
                                    resultMsg: android.os.Message?
                                ): Boolean {
                                    if (!isUserGesture || resultMsg == null) return false
                                    val popup = WebView(context).apply {
                                        settings.javaScriptEnabled = true
                                        settings.domStorageEnabled = true
                                        settings.setSupportMultipleWindows(false)
                                        webViewClient = object : WebViewClient() {
                                            override fun shouldOverrideUrlLoading(
                                                view: WebView,
                                                request: WebResourceRequest
                                            ): Boolean {
                                                val target = request.url
                                                if (isFlyInfinityUrl(target)) {
                                                    hostWebView.loadUrl(target.toString())
                                                } else {
                                                    openExternal(target)
                                                }
                                                view.stopLoading()
                                                view.destroy()
                                                return true
                                            }
                                        }
                                    }
                                    val transport = resultMsg.obj as? WebView.WebViewTransport ?: run {
                                        popup.destroy()
                                        return false
                                    }
                                    transport.webView = popup
                                    resultMsg.sendToTarget()
                                    return true
                                }

                                override fun onShowFileChooser(
                                    webView: WebView?,
                                    filePathCallback: ValueCallback<Array<Uri>>?,
                                    fileChooserParams: FileChooserParams?
                                ): Boolean {
                                    if (filePathCallback == null || fileChooserParams == null) {
                                        return false
                                    }
                                    return onFileChooser(filePathCallback, fileChooserParams)
                                }

                                override fun onProgressChanged(view: WebView, newProgress: Int) {
                                    isLoading = newProgress < 100
                                }
                            }

                            webView = this
                            applyWebCachePolicy(this, context)
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
                                    webView?.let { applyWebCachePolicy(it, context); it.loadUrl(currentUrl) }
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
