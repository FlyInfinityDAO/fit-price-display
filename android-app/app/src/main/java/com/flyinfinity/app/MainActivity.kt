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
import androidx.webkit.WebViewCompat
import android.widget.Toast
import java.io.File
import java.net.HttpURLConnection
import java.net.URI
import android.view.View
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material3.NavigationBarItemDefaults
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
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



/**
 * Mirrors the small set of third-party presentation/runtime assets used by
 * site pages (Font Awesome, Google Fonts, Chart.js and ethers) for offline use.
 * Only explicitly approved CDN hosts and asset paths are intercepted.
 */
private class ExternalAssetCache(private val context: Context) {
    private val directory = File(context.filesDir, "fly-external-assets").apply { mkdirs() }
    private val seeds = listOf(
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css",
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css",
        "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
        "https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js",
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Vazirmatn:wght@400;500;600;700;800&family=Estedad:wght@400;500;600;700;800&display=swap",
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap"
    )

    private fun isAllowed(url: String): Boolean {
        val uri = runCatching { URI(url) }.getOrNull() ?: return false
        if (uri.scheme != "https") return false
        val host = uri.host?.lowercase() ?: return false
        val path = uri.path.orEmpty()
        return when (host) {
            "cdnjs.cloudflare.com" ->
                path.startsWith("/ajax/libs/font-awesome/") &&
                    (path.endsWith(".css") || path.contains("/webfonts/"))
            "cdn.jsdelivr.net" ->
                path == "/npm/chart.js@4.4.0/dist/chart.umd.min.js" ||
                    path == "/npm/ethers@5.7.2/dist/ethers.umd.min.js"
            "fonts.googleapis.com" -> path == "/css2"
            "fonts.gstatic.com" -> path.endsWith(".woff2") || path.endsWith(".woff")
            else -> false
        }
    }

    private fun cacheFile(url: String): File {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(url.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return File(directory, "$digest.asset")
    }

    private fun mimeType(url: String): String {
        val path = runCatching { URI(url).path.orEmpty() }.getOrDefault("")
        return when {
            path.endsWith(".css") || path == "/css2" -> "text/css"
            path.endsWith(".js") -> "application/javascript"
            path.endsWith(".woff2") -> "font/woff2"
            path.endsWith(".woff") -> "font/woff"
            path.endsWith(".ttf") -> "font/ttf"
            else -> "application/octet-stream"
        }
    }

    private fun fetch(url: String): ByteArray? {
        if (!isAllowed(url)) return null
        val connection = (URL(url).openConnection() as? HttpURLConnection) ?: return null
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10000
            connection.readTimeout = 20000
            connection.instanceFollowRedirects = true
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
            )
            if (connection.responseCode in 200..299) {
                connection.inputStream.use { it.readBytes() }
            } else null
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun save(url: String, bytes: ByteArray) {
        runCatching {
            val target = cacheFile(url)
            val temp = File(directory, target.name + ".tmp")
            temp.writeBytes(bytes)
            if (!temp.renameTo(target)) {
                target.writeBytes(bytes)
                temp.delete()
            }
        }
    }

    private fun response(url: String, bytes: ByteArray) = WebResourceResponse(
        mimeType(url),
        if (mimeType(url).startsWith("text/") || mimeType(url).contains("javascript")) "UTF-8" else null,
        200,
        "OK",
        mapOf("Cache-Control" to "no-store"),
        bytes.inputStream()
    )

    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        if (request.method != "GET") return null
        val url = request.url.toString()
        if (!isAllowed(url) || hasValidatedInternet(context)) return null
        val file = cacheFile(url)
        return if (file.isFile) runCatching { response(url, file.readBytes()) }.getOrNull() else null
    }

    /** Downloads CSS first, then the font files referenced by those stylesheets. */
    fun prefetchAll() {
        if (!hasValidatedInternet(context)) return
        Thread {
            val executor = java.util.concurrent.Executors.newFixedThreadPool(3)
            try {
                seeds.forEach { seed ->
                    executor.submit {
                        val bytes = fetch(seed) ?: return@submit
                        save(seed, bytes)
                        if (mimeType(seed) == "text/css") {
                            val css = runCatching { bytes.toString(Charsets.UTF_8) }.getOrDefault("")
                            val dependencies = Regex("""url\(\s*(['"]?)([^'")]+)\1\s*\)""")
                                .findAll(css)
                                .mapNotNull { match ->
                                    val raw = match.groupValues[2].trim()
                                    if (raw.startsWith("data:")) null
                                    else runCatching { URI(seed).resolve(raw).toString() }.getOrNull()
                                }
                                .filter { isAllowed(it) }
                                .distinct()
                            dependencies.forEach { dependency ->
                                if (hasValidatedInternet(context)) {
                                    fetch(dependency)?.let { save(dependency, it) }
                                }
                            }
                        }
                    }
                }
            } finally {
                executor.shutdown()
                try {
                    executor.awaitTermination(5, java.util.concurrent.TimeUnit.MINUTES)
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                }
            }
        }.apply { name = "FlyExternalAssetPrefetch"; isDaemon = true }.start()
    }
}

/**
 * App-only offline mirror of every static site page and its repository assets.
 * The manifest is compiled into the APK; no website/repository files are changed.
 */
private class FullSiteCache(private val context: Context) {
    private val directory = File(context.filesDir, "fly-full-site").apply { mkdirs() }
    private val allowedPaths = setOf(
        "airdrop-stats.json",
        "audit.html",
        "background-desktop.png",
        "background-mobile.png",
        "backup-privacy.html",
        "backup-terms.html",
        "card-hover.css",
        "card-hover.js",
        "compare.html",
        "crypto-cache.json",
        "dapp-buy-fit.html",
        "dapp-gift.html",
        "dapp-ownership.html",
        "dapp-sell-fit.html",
        "dapp.html",
        "dapp/ar.json",
        "dapp/en.json",
        "dapp/es.json",
        "dapp/fa.json",
        "dapp/pt.json",
        "dapp/ru.json",
        "dapp/tr.json",
        "dapp/zh.json",
        "ecosystem-dashboard.js",
        "ecosystem-visual.js",
        "faq.html",
        "fly-ai/css/fly-ai.css",
        "fly-ai/index.html",
        "fly-ai/js/app.js",
        "fly-ai/js/config.js",
        "fly-ai/js/i18n.js",
        "games/backgammon/css/backgammon.css",
        "games/backgammon/index.html",
        "games/backgammon/js/backgammon-engine.js",
        "games/backgammon/js/backgammon-engine.test.js",
        "games/backgammon/js/backgammon.js",
        "games/chess-arena/css/chess-arena.css",
        "games/chess-arena/index.html",
        "games/chess-arena/js/chess-arena.js",
        "games/chess-arena/js/language.js",
        "games/chess-arena/worker/package.json",
        "games/chess-arena/worker/src/backgammon-room.js",
        "games/chess-arena/worker/src/index.js",
        "games/chess-arena/worker/src/ludo-room.js",
        "games/chess-arena/worker/src/room.js",
        "games/chess-arena/worker/src/rooms-api.js",
        "games/chess-arena/worker/src/security.js",
        "games/fi-neon-games.css",
        "games/hokm/css/hokm-neon-theme.css",
        "games/hokm/css/hokm.css",
        "games/hokm/engine/hokm-engine.js",
        "games/hokm/index.html",
        "games/hokm/js/hokm-android-scroll.js",
        "games/hokm/js/hokm-neon-ambient.js",
        "games/hokm/js/hokm-online.js",
        "games/hokm/js/hokm-play.js",
        "games/hokm/js/hokm-wallet-bridge.js",
        "games/hokm/js/hokm.js",
        "games/hokm/worker/package.json",
        "games/hokm/worker/src/index.js",
        "games/hokm/worker/src/room.js",
        "games/hokm/worker/src/security.js",
        "games/index.html",
        "games/ludo/css/ludo.css",
        "games/ludo/index.html",
        "games/ludo/js/ludo-engine.js",
        "games/ludo/js/ludo-engine.test.js",
        "games/ludo/js/ludo-mobile-scroll.js",
        "games/ludo/js/ludo.js",
        "games/ludo/package.json",
        "games/ludo/worker/package.json",
        "games/ludo/worker/src/index.js",
        "games/ludo/worker/src/ludo-room.js",
        "games/ludo/worker/src/rooms-api.js",
        "games/ludo/worker/src/security.js",
        "games/shared-language-menu.js",
        "games/shared-neon-ambient.js",
        "games/snakes-and-ladders/css/snakes.css",
        "games/snakes-and-ladders/index.html",
        "games/snakes-and-ladders/js/snakes-engine.js",
        "games/snakes-and-ladders/js/snakes-engine.test.js",
        "games/snakes-and-ladders/js/snakes-mobile-scroll.js",
        "games/snakes-and-ladders/js/snakes.js",
        "games/snakes-and-ladders/worker/package.json",
        "games/snakes-and-ladders/worker/src/index.js",
        "games/snakes-and-ladders/worker/src/rules.js",
        "games/snakes-and-ladders/worker/src/security.js",
        "games/snakes-and-ladders/worker/src/snakes-room.js",
        "holders-data.json",
        "index.html",
        "lang.js",
        "lang/audit/ar.json",
        "lang/audit/en.json",
        "lang/audit/es.json",
        "lang/audit/fa.json",
        "lang/audit/pt.json",
        "lang/audit/ru.json",
        "lang/audit/tr.json",
        "lang/audit/zh.json",
        "lang/compare/ar.json",
        "lang/compare/en.json",
        "lang/compare/es.json",
        "lang/compare/fa.json",
        "lang/compare/pt.json",
        "lang/compare/ru.json",
        "lang/compare/tr.json",
        "lang/compare/zh.json",
        "lang/dapp/ar.json",
        "lang/dapp/en.json",
        "lang/dapp/es.json",
        "lang/dapp/fa.json",
        "lang/dapp/pt.json",
        "lang/dapp/ru.json",
        "lang/dapp/tr.json",
        "lang/dapp/zh.json",
        "lang/faq/ar.json",
        "lang/faq/en.json",
        "lang/faq/es.json",
        "lang/faq/fa.json",
        "lang/faq/pt.json",
        "lang/faq/ru.json",
        "lang/faq/tr.json",
        "lang/faq/zh.json",
        "lang/index/ar.json",
        "lang/index/en.json",
        "lang/index/es.json",
        "lang/index/fa.json",
        "lang/index/pt.json",
        "lang/index/ru.json",
        "lang/index/tr.json",
        "lang/index/zh.json",
        "lang/next-projects/ar.json",
        "lang/next-projects/en.json",
        "lang/next-projects/es.json",
        "lang/next-projects/fa.json",
        "lang/next-projects/pt.json",
        "lang/next-projects/ru.json",
        "lang/next-projects/tr.json",
        "lang/next-projects/zh.json",
        "lang/privacy/ar.json",
        "lang/privacy/en.json",
        "lang/privacy/es.json",
        "lang/privacy/fa.json",
        "lang/privacy/pt.json",
        "lang/privacy/ru.json",
        "lang/privacy/tr.json",
        "lang/privacy/zh.json",
        "lang/profit-simulator/ar.json",
        "lang/profit-simulator/en.json",
        "lang/profit-simulator/es.json",
        "lang/profit-simulator/fa.json",
        "lang/profit-simulator/pt.json",
        "lang/profit-simulator/ru.json",
        "lang/profit-simulator/tr.json",
        "lang/profit-simulator/zh.json",
        "lang/transactions/ar.json",
        "lang/transactions/en.json",
        "lang/transactions/es.json",
        "lang/transactions/fa.json",
        "lang/transactions/pt.json",
        "lang/transactions/ru.json",
        "lang/transactions/tr.json",
        "lang/transactions/zh.json",
        "lang/warnings/ar.json",
        "lang/warnings/en.json",
        "lang/warnings/es.json",
        "lang/warnings/fa.json",
        "lang/warnings/pt.json",
        "lang/warnings/ru.json",
        "lang/warnings/tr.json",
        "lang/warnings/zh.json",
        "lang/what-is-fit/ar.json",
        "lang/what-is-fit/en.json",
        "lang/what-is-fit/es.json",
        "lang/what-is-fit/fa.json",
        "lang/what-is-fit/pt.json",
        "lang/what-is-fit/ru.json",
        "lang/what-is-fit/tr.json",
        "lang/what-is-fit/zh.json",
        "lang/whitepaper/ar.json",
        "lang/whitepaper/en.json",
        "lang/whitepaper/es.json",
        "lang/whitepaper/fa.json",
        "lang/whitepaper/pt.json",
        "lang/whitepaper/ru.json",
        "lang/whitepaper/tr.json",
        "lang/whitepaper/zh.json",
        "logo.png",
        "next-projects.html",
        "package.json",
        "price-calculator.html",
        "price-history-table.json",
        "price-history.json",
        "privacy.html",
        "profit-simulator.html",
        "ps.html",
        "trading-volume-progress.json",
        "trading-volume.json",
        "transactions.html",
        "update-airdrop.js",
        "update-cache.js",
        "update-price.js",
        "update-trading-volume.js",
        "wallet-connect.js",
        "wallet-ui.css",
        "wallet-ui.js",
        "walletconnect-bridge.js",
        "warnings.html",
        "what-is-fit.html",
        "whitepaper.html"
    )

    private fun normalizedPath(uri: Uri): String? {
        if (uri.scheme != "https" || uri.host != SITE_HOST) return null
        var path = uri.path.orEmpty()
        if (path == SITE_PATH || path == "$SITE_PATH/") path = "$SITE_PATH/index.html"
        if (!path.startsWith("$SITE_PATH/")) return null
        val relative = path.removePrefix("$SITE_PATH/")
        return relative.takeIf { it in allowedPaths }
    }

    private fun cacheFile(path: String): File {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(path.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return File(directory, digest + ".cache")
    }

    private fun mimeType(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
        "html", "htm" -> "text/html"
        "css" -> "text/css"
        "js" -> "application/javascript"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "ico" -> "image/x-icon"
        "woff" -> "font/woff"
        "woff2" -> "font/woff2"
        "ttf" -> "font/ttf"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        else -> "application/octet-stream"
    }

    private fun fetch(path: String): ByteArray? {
        val url = "https://$SITE_HOST$SITE_PATH/$path"
        val connection = (URL(url).openConnection() as? HttpURLConnection) ?: return null
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10000
            connection.readTimeout = 20000
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("Cache-Control", "no-cache")
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
            val temp = File(directory, target.name + ".tmp")
            temp.writeBytes(bytes)
            if (!temp.renameTo(target)) {
                target.writeBytes(bytes)
                temp.delete()
            }
        }
    }

    private fun response(path: String, bytes: ByteArray) = WebResourceResponse(
        mimeType(path),
        if (mimeType(path).startsWith("text/") || mimeType(path).contains("javascript") ||
            mimeType(path).contains("json") || mimeType(path).startsWith("image/svg")) "UTF-8" else null,
        200,
        "OK",
        mapOf("Cache-Control" to "no-store"),
        bytes.inputStream()
    )

    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        if (request.method != "GET") return null
        val path = normalizedPath(request.url) ?: return null
        // Let WebView load live resources normally while online. The startup
        // prefetcher refreshes the full mirror in the background without blocking pages.
        if (hasValidatedInternet(context)) return null
        val file = cacheFile(path)
        return if (file.isFile) runCatching { response(path, file.readBytes()) }.getOrNull() else null
    }

    /** Called once when a fresh app process starts online; refreshes every page and asset. */
    fun prefetchAll() {
        if (!hasValidatedInternet(context)) return
        Thread {
            val executor = java.util.concurrent.Executors.newFixedThreadPool(4)
            try {
                allowedPaths.forEach { path ->
                    executor.submit {
                        if (hasValidatedInternet(context)) {
                            fetch(path)?.let { save(path, it) }
                        }
                    }
                }
            } finally {
                executor.shutdown()
                try {
                    executor.awaitTermination(15, java.util.concurrent.TimeUnit.MINUTES)
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                }
            }
        }.apply { name = "FlyFullSitePrefetch"; isDaemon = true }.start()
    }
}

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

private const val WEBVIEW_MOTION_COMPATIBILITY_SCRIPT = """
(function() {
  try {
    var originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = function(query) {
      if (typeof query === 'string' && /prefers-reduced-motion\s*:\s*reduce/i.test(query)) {
        return {
          matches: false,
          media: query,
          onchange: null,
          addListener: function() {},
          removeListener: function() {},
          addEventListener: function() {},
          removeEventListener: function() {},
          dispatchEvent: function() { return true; }
        };
      }
      return originalMatchMedia(query);
    };
  } catch (_) {}
})();
"""

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
    val fullSiteCache = remember(context) { FullSiteCache(context) }
    val externalAssetCache = remember(context) { ExternalAssetCache(context) }
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.fly_infinity_logo),
                        contentDescription = "Fly Infinity DAO",
                        modifier = Modifier.size(38.dp)
                    )
                    Text(
                        "FLY INFINITY DAO",
                        color = FlyGold,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleLarge
                    )
                }
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
                            WebViewCompat.addDocumentStartJavaScript(
                                this,
                                WEBVIEW_MOTION_COMPATIBILITY_SCRIPT,
                                setOf("https://flyinfinitydao.github.io")
                            )
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
                            // Keep CSS backdrop-filter/glass effects composited in offline WebView pages.
                            setLayerType(View.LAYER_TYPE_HARDWARE, null)

                            webViewClient = object : WebViewClient() {
                                override fun shouldInterceptRequest(
                                    view: WebView,
                                    request: WebResourceRequest
                                ): WebResourceResponse? {
                                    return externalAssetCache.intercept(request)
                                        ?: fullSiteCache.intercept(request)
                                        ?: dashboardDataCache.intercept(request)
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
                                        // Mirror the exact visual layers already used by the website:
                                        // 1) main site background image on non-game/non-AI pages;
                                        // 2) Fly AI's ambient orb animation on every game page.
                                        // This is Android WebView-only and does not modify hosted files.
                                        view.evaluateJavascript(
                                            """
                                            (function(){
                                              try{
                                                var path=location.pathname||'';
                                                var isGame=path.indexOf('/games/')!==-1;
                                                var isFlyAi=path.indexOf('/fly-ai/')!==-1;
                                                var styleId='fly-android-page-visuals';
                                                var style=document.getElementById(styleId);
                                                if(!style){
                                                  style=document.createElement('style');
                                                  style.id=styleId;
                                                  (document.head||document.documentElement).appendChild(style);
                                                }
                                                var css='';
                                                if(!isGame&&!isFlyAi){
                                                  css +=
                                                    'html{background-color:#0f0f0f!important;background-image:linear-gradient(rgba(15,15,15,.60),rgba(15,15,15,.60)),url("/fit-price-display/background-desktop.png")!important;background-size:cover!important;background-position:center center!important;background-repeat:no-repeat!important;background-attachment:fixed!important}' +
                                                    'body{background:transparent!important}' +
                                                    '@media(max-width:768px){html{background-image:linear-gradient(rgba(15,15,15,.60),rgba(15,15,15,.60)),url("/fit-price-display/background-mobile.png")!important;background-size:contain!important;background-position:center top!important;background-repeat:repeat-y!important;background-attachment:scroll!important;background-color:#0f0f0f!important}}';
                                                }
                                                if(isGame){
                                                  css +=
                                                    '.ai-motion-bg{position:fixed!important;inset:0!important;z-index:1!important;overflow:hidden!important;pointer-events:none!important;isolation:isolate!important;contain:paint!important;opacity:1!important;visibility:visible!important;background-image:radial-gradient(ellipse at 18% 28%,rgba(124,67,255,.30),transparent 36%),radial-gradient(ellipse at 82% 62%,rgba(0,190,215,.27),transparent 39%),radial-gradient(ellipse at 52% 92%,rgba(26,205,190,.16),transparent 34%)!important;background-size:190% 190%!important;animation:flyAiEnergyFlow 9s ease-in-out infinite alternate!important}' +
                                                    '.arena{position:relative!important;z-index:2!important}' +
                                                    '#fi-games-neon-canvas{z-index:0!important;pointer-events:none!important}' +
                                                    '.ai-motion-bg:before{content:""!important;position:absolute!important;inset:-12%!important;background-image:linear-gradient(rgba(155,119,255,.095) 1px,transparent 1px),linear-gradient(90deg,rgba(38,220,222,.085) 1px,transparent 1px)!important;background-size:76px 76px!important;opacity:.68!important;animation:flyAiGridDrift 7s linear infinite!important}' +
                                                    '.ai-motion-bg:after{content:""!important;position:absolute!important;inset:-25%!important;background:conic-gradient(from 20deg at 50% 50%,transparent 0 20%,rgba(130,75,255,.22) 33%,transparent 45% 60%,rgba(0,202,220,.20) 74%,transparent 87%)!important;filter:blur(30px) saturate(155%)!important;opacity:.95!important;animation:flyAiFieldDrift 10s ease-in-out infinite alternate!important}' +
                                                    '.ai-motion-orb{position:absolute!important;display:block!important;border-radius:50%!important;filter:blur(38px) saturate(145%)!important;transform:translate3d(0,0,0)!important;will-change:transform,opacity!important}' +
                                                    '.ai-motion-orb.orb-violet{width:clamp(220px,34vw,520px)!important;height:clamp(220px,34vw,520px)!important;left:-12%!important;top:8%!important;background:radial-gradient(circle,rgba(124,72,255,.58),rgba(124,72,255,.23) 48%,transparent 74%)!important;animation:flyAiOrbViolet 10s ease-in-out infinite alternate!important}' +
                                                    '.ai-motion-orb.orb-cyan{width:clamp(230px,38vw,560px)!important;height:clamp(230px,38vw,560px)!important;right:-14%!important;top:34%!important;background:radial-gradient(circle,rgba(0,198,220,.52),rgba(0,198,220,.21) 48%,transparent 74%)!important;animation:flyAiOrbCyan 12s ease-in-out infinite alternate!important}' +
                                                    '.ai-motion-orb.orb-gold{width:clamp(170px,24vw,360px)!important;height:clamp(170px,24vw,360px)!important;left:36%!important;bottom:-18%!important;background:radial-gradient(circle,rgba(35,194,190,.30),rgba(35,194,190,.10) 48%,transparent 74%)!important;animation:flyAiOrbGold 14s ease-in-out infinite alternate!important}' +
                                                    '@keyframes flyAiEnergyFlow{0%{background-position:0% 10%;filter:hue-rotate(0deg)}50%{background-position:65% 90%;filter:hue-rotate(12deg)}100%{background-position:100% 15%;filter:hue-rotate(-8deg)}}' +
                                                    '@keyframes flyAiOrbViolet{0%{transform:translate3d(-2vw,-1vh,0) scale(.82);opacity:.62}55%{transform:translate3d(24vw,15vh,0) scale(1.13);opacity:1}100%{transform:translate3d(39vw,4vh,0) scale(.96);opacity:.78}}' +
                                                    '@keyframes flyAiOrbCyan{0%{transform:translate3d(2vw,2vh,0) scale(1.02);opacity:.58}50%{transform:translate3d(-23vw,-17vh,0) scale(.84);opacity:1}100%{transform:translate3d(-39vw,8vh,0) scale(1.12);opacity:.76}}' +
                                                    '@keyframes flyAiOrbGold{0%{transform:translate3d(-5vw,3vh,0) scale(.82);opacity:.46}50%{transform:translate3d(12vw,-17vh,0) scale(1.2);opacity:.9}100%{transform:translate3d(27vw,-4vh,0) scale(.94);opacity:.62}}' +
                                                    '@keyframes flyAiGridDrift{from{background-position:0 0,0 0}to{background-position:136px 68px,-136px 68px}}' +
                                                    '@keyframes flyAiFieldDrift{from{transform:rotate(-20deg) scale(.86)}to{transform:rotate(24deg) scale(1.16)}}' +
                                                    '@media(max-width:620px){.ai-motion-bg{animation-duration:11s!important;background-size:230% 230%!important}.ai-motion-bg:before{opacity:.58!important;animation-duration:8s!important}.ai-motion-bg:after{filter:blur(25px) saturate(160%)!important;opacity:.88!important;animation-duration:12s!important}.ai-motion-orb{filter:blur(32px) saturate(155%)!important}.ai-motion-orb.orb-violet{animation-duration:11s!important}.ai-motion-orb.orb-cyan{animation-duration:13s!important}.ai-motion-orb.orb-gold{animation-duration:15s!important}}' +
                                                    '@media(prefers-reduced-motion:reduce){.ai-motion-bg,.ai-motion-bg:before,.ai-motion-bg:after,.ai-motion-orb.orb-violet,.ai-motion-orb.orb-cyan,.ai-motion-orb.orb-gold{animation-duration:24s!important;animation-timing-function:linear!important;animation-iteration-count:infinite!important}}';
                                                  if(!document.querySelector('.ai-motion-bg')){
                                                    var field=document.createElement('div');
                                                    field.className='ai-motion-bg';
                                                    field.setAttribute('aria-hidden','true');
                                                    field.innerHTML='<span class="ai-motion-orb orb-violet"></span><span class="ai-motion-orb orb-cyan"></span><span class="ai-motion-orb orb-gold"></span>';
                                                    (document.body||document.documentElement).insertBefore(field,(document.body||document.documentElement).firstChild);
                                                  }
                                                }
                                                style.textContent=css;
                                              }catch(e){console.warn('Fly Android visual compatibility:',e)}
                                            })();
                                            """.trimIndent(),
                                            null
                                        )
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
                            if (hasValidatedInternet(context)) {
                                fullSiteCache.prefetchAll()
                                externalAssetCache.prefetchAll()
                            }
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

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                color = Color(0xCC101A15),
                shape = RoundedCornerShape(24.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.16f)),
                shadowElevation = 16.dp
            ) {
                NavigationBar(
                    containerColor = Color.Transparent,
                    tonalElevation = 0.dp
                ) {
                    AppDestination.entries.forEach { item ->
                        NavigationBarItem(
                            selected = destination == item,
                            onClick = { openDestination(item) },
                            icon = {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
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
                                    if (destination == item) {
                                        Box(
                                            modifier = Modifier
                                                .padding(top = 5.dp)
                                                .width(28.dp)
                                                .height(3.dp)
                                                .shadow(9.dp, RoundedCornerShape(50))
                                                .background(Color(0xFFFFFF00), RoundedCornerShape(50))
                                        )
                                    }
                                }
                            },
                            label = { Text(item.label, fontWeight = FontWeight.SemiBold) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = FlyTeal,
                                selectedTextColor = FlyTeal,
                                unselectedIconColor = FlyTeal,
                                unselectedTextColor = FlyTeal,
                                indicatorColor = Color.Transparent
                            )
                        )
                    }
                }
            }
        }
    }
}
