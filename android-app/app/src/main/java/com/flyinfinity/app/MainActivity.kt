package com.flyinfinity.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

private const val SITE_ROOT = "https://flyinfinitydao.github.io/fit-price-display/"

private enum class AppDestination(val label: String, val path: String) {
    Dashboard("Home", ""),
    DApp("DApp", "dapp.html"),
    Games("Games", "games/"),
    FlyAI("Fly AI", "fly-ai/")
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
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

    fun openDestination(target: AppDestination) {
        destination = target
        webView?.loadUrl(SITE_ROOT + target.path)
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
                Text("FLY INFINITY", style = MaterialTheme.typography.titleLarge)
                Text("BNB SMART CHAIN", style = MaterialTheme.typography.labelSmall)
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
                            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(
                                    view: WebView,
                                    request: WebResourceRequest
                                ): Boolean {
                                    val uri = request.url
                                    val scheme = uri.scheme.orEmpty()
                                    val host = uri.host.orEmpty()
                                    if (scheme == "https" && host == "flyinfinitydao.github.io") {
                                        return false
                                    }
                                    return try {
                                        context.startActivity(
                                            Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
                                        )
                                        true
                                    } catch (_: Exception) {
                                        true
                                    }
                                }
                            }

                            webView = this
                            loadUrl(SITE_ROOT)
                        }
                    },
                    update = { webView = it }
                )
            }

            NavigationBar {
                AppDestination.entries.forEach { item ->
                    NavigationBarItem(
                        selected = destination == item,
                        onClick = { openDestination(item) },
                        icon = {
                            when (item) {
                                AppDestination.Dashboard -> androidx.compose.material3.Icon(Icons.Filled.Home, contentDescription = item.label)
                                AppDestination.DApp -> androidx.compose.material3.Icon(Icons.Filled.SwapHoriz, contentDescription = item.label)
                                AppDestination.Games -> androidx.compose.material3.Icon(Icons.Filled.Casino, contentDescription = item.label)
                                AppDestination.FlyAI -> androidx.compose.material3.Icon(Icons.Filled.SmartToy, contentDescription = item.label)
                            }
                        },
                        label = { Text(item.label) }
                    )
                }
            }
        }
    }
}
