# Fly Infinity Android App

Native Android companion for the existing Fly Infinity website.

## Product decisions
- Experience: hybrid (native Android shell + existing website pages in WebView)
- Offline: partial (native shell and explicitly cached/read-only content where safe; live wallet, blockchain, multiplayer and AI features require connectivity)
- Distribution: directly installable APK

## Source of truth
The existing website remains the product source of truth:
https://flyinfinitydao.github.io/fit-price-display/

The Android project is isolated under `android-app/`. Do not move, rewrite, or modify existing website pages or Cloudflare Workers as part of Android-only work unless a separately reviewed integration change is required.

## Initial implementation
The first milestone provides:
- Native Android application shell
- WebView loading the production website
- Native bottom navigation to Dashboard, DApp, Games and Fly AI
- Android back navigation
- HTTPS-only content loading and external-link handoff
- GitHub Actions workflow to build a debug APK

## Important integration work still required
- WalletConnect/Reown and wallet-app deep-link round-trip testing
- File chooser and download support
- Offline strategy and cache validation
- Native error/retry and connection-state UX
- Testing on physical Android devices, including TokenPocket
- Release signing and production APK pipeline

No wallet signing, private keys, seed phrases, or sensitive credentials are handled by the native shell.
