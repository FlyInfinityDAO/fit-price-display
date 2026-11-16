/* Fly Infinity — isolated PWA installation experience */
(() => {
  "use strict";

  const INSTALLED_KEY = "fi_pwa_installed_v2";
  const scriptUrl = document.currentScript && document.currentScript.src;
  const baseUrl = scriptUrl ? new URL("./", scriptUrl) : new URL("./", location.href);
  // Register the offline service worker even when the app is already installed.
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register(new URL("sw.js", baseUrl).href, {scope: baseUrl.pathname})
      .catch(error => console.warn("[Fly Infinity PWA] Service worker registration failed:", error));
  }

  let wasOffline = !navigator.onLine;
  window.__fiOfflineReloadPending = false;
  window.addEventListener("offline", () => { wasOffline = true; });
  window.addEventListener("online", () => {
    if (!wasOffline) return;
    wasOffline = false;
    window.__fiOfflineReloadPending = true;
    const requestUpdate = () => {
      navigator.serviceWorker.ready.then(registration => {
        const worker = navigator.serviceWorker.controller || registration.active;
        if (worker) worker.postMessage({type:"FI_CHECK_UPDATES"});
        else registration.update();
      }).catch(() => {});
    };
    requestUpdate();
  });
  navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", event => {
    if (event.data && event.data.type === "FI_CONTENT_UPDATED" && event.data.ready && wasOffline === false) {
      if (window.__fiOfflineReloadPending) {
        window.__fiOfflineReloadPending = false;
        location.reload();
      }
    }
  });

  const isStandalone = () =>
    (window.matchMedia && (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches
    )) || navigator.standalone === true;

  const safeGet = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };

  if (isStandalone()) {
    safeSet(INSTALLED_KEY, "1");
    return;
  }
  if (safeGet(INSTALLED_KEY) === "1") return;

  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroidChrome = /Android/i.test(ua) && /Chrome\/[0-9]+/i.test(ua) &&
    !/EdgA|OPR|SamsungBrowser|YaBrowser/i.test(ua);

  if (!isIOS && !isAndroidChrome) return;

  const translations = {
    en: {title:"Install Fly Infinity",body:"Add the Fly Infinity app to your home screen for a faster, app-like experience.",install:"Install app",later:"Not now",iosTitle:"Add Fly Infinity to your Home Screen",iosBody:"Install the Fly Infinity web app in a few quick steps:",step1:"Tap the Share button in your browser.",step2:"Choose “Add to Home Screen”.",step3:"Confirm by tapping “Add”.",done:"Got it",hint:"If you are using an iPhone browser that does not show this option, open this page in Safari and use Share.",menuTitle:"Install Fly Infinity from Chrome",menuBody:"Chrome has not opened its direct install prompt yet. You can still install Fly Infinity from the browser menu:",menuStep1:"Open the Chrome menu (⋮) in the top corner.",menuStep2:"Choose “Install app” or “Add to Home screen”.",menuStep3:"Confirm the installation. The app should open without the browser address bar."},
    fa: {title:"نصب اپلیکیشن Fly Infinity",body:"با افزودن اپلیکیشن فلای اینفینیتی به صفحه اصلی، سریع‌تر و مانند یک اپلیکیشن مستقل به اکوسیستم دسترسی داشته باشید.",install:"نصب اپلیکیشن",later:"فعلاً نه",iosTitle:"افزودن Fly Infinity به صفحه اصلی",iosBody:"برای نصب وب‌اپلیکیشن فلای اینفینیتی این مراحل را انجام دهید:",step1:"دکمه اشتراک‌گذاری (Share) مرورگر را لمس کنید.",step2:"گزینه Add to Home Screen را انتخاب کنید.",step3:"در پایان گزینه Add را تأیید کنید.",done:"متوجه شدم",hint:"اگر این گزینه را در مرورگر خود نمی‌بینید، صفحه را در Safari باز کنید و از منوی Share استفاده کنید.",menuTitle:"نصب Fly Infinity از منوی Chrome",menuBody:"مرورگر هنوز پنجره مستقیم نصب را فعال نکرده است. می‌توانید از منوی مرورگر نصب را انجام دهید:",menuStep1:"منوی سه‌نقطه Chrome را باز کنید.",menuStep2:"گزینه Install app یا Add to Home screen را انتخاب کنید.",menuStep3:"نصب را تأیید کنید؛ اپ باید بدون نوار آدرس مرورگر باز شود."},
    ar: {title:"تثبيت Fly Infinity",body:"أضف تطبيق Fly Infinity إلى الشاشة الرئيسية للوصول إلى المنظومة بسرعة وبطريقة تشبه التطبيقات.",install:"تثبيت التطبيق",later:"ليس الآن",iosTitle:"إضافة Fly Infinity إلى الشاشة الرئيسية",iosBody:"اتبع الخطوات التالية لتثبيت تطبيق الويب:",step1:"اضغط على زر المشاركة في المتصفح.",step2:"اختر Add to Home Screen.",step3:"أكد العملية بالضغط على Add.",done:"فهمت",hint:"إذا لم يظهر الخيار في متصفحك، افتح الصفحة في Safari واستخدم قائمة المشاركة.",menuTitle:"تثبيت Fly Infinity من Chrome",menuBody:"لم يفتح Chrome نافذة التثبيت المباشرة بعد. يمكنك تثبيت التطبيق من قائمة المتصفح:",menuStep1:"افتح قائمة Chrome ذات النقاط الثلاث.",menuStep2:"اختر Install app أو Add to Home screen.",menuStep3:"أكد التثبيت. يجب أن يفتح التطبيق دون شريط عنوان المتصفح."},
    tr: {title:"Fly Infinity Uygulamasını Yükle",body:"Daha hızlı ve uygulama benzeri erişim için Fly Infinity'yi ana ekranınıza ekleyin.",install:"Uygulamayı yükle",later:"Şimdi değil",iosTitle:"Fly Infinity'yi Ana Ekrana Ekle",iosBody:"Web uygulamasını yüklemek için şu adımları izleyin:",step1:"Tarayıcınızdaki Paylaş düğmesine dokunun.",step2:"Add to Home Screen seçeneğini seçin.",step3:"Add düğmesine dokunarak onaylayın.",done:"Anladım",hint:"Bu seçenek görünmüyorsa sayfayı Safari'de açıp Paylaş menüsünü kullanın.",menuTitle:"Fly Infinity uygulamasını Chrome menüsünden yükle",menuBody:"Chrome henüz doğrudan yükleme penceresini açmadı. Uygulamayı tarayıcı menüsünden yükleyebilirsiniz:",menuStep1:"Chrome üç nokta menüsünü açın.",menuStep2:"Install app veya Add to Home screen seçeneğini seçin.",menuStep3:"Yüklemeyi onaylayın. Uygulama adres çubuğu olmadan açılmalıdır."},
    ru: {title:"Установить Fly Infinity",body:"Добавьте Fly Infinity на главный экран для быстрого доступа в формате приложения.",install:"Установить",later:"Не сейчас",iosTitle:"Добавить Fly Infinity на экран Домой",iosBody:"Выполните несколько шагов для установки веб-приложения:",step1:"Нажмите кнопку «Поделиться» в браузере.",step2:"Выберите Add to Home Screen.",step3:"Подтвердите, нажав Add.",done:"Понятно",hint:"Если этот пункт недоступен, откройте страницу в Safari и воспользуйтесь меню «Поделиться».",menuTitle:"Установка Fly Infinity через Chrome",menuBody:"Chrome пока не открыл прямое окно установки. Вы можете установить приложение через меню браузера:",menuStep1:"Откройте меню Chrome (три точки).",menuStep2:"Выберите Install app или Add to Home screen.",menuStep3:"Подтвердите установку. Приложение должно открываться без адресной строки."},
    zh: {title:"安装 Fly Infinity",body:"将 Fly Infinity 添加到主屏幕，享受更快捷、接近原生应用的体验。",install:"安装应用",later:"暂不",iosTitle:"将 Fly Infinity 添加到主屏幕",iosBody:"按照以下步骤安装网页应用：",step1:"点击浏览器中的分享按钮。",step2:"选择“添加到主屏幕”。",step3:"点击“添加”进行确认。",done:"知道了",hint:"如果浏览器中没有此选项，请在 Safari 中打开此页面并使用分享菜单。",menuTitle:"通过 Chrome 菜单安装 Fly Infinity",menuBody:"Chrome 尚未显示直接安装窗口。您仍可通过浏览器菜单安装：",menuStep1:"打开 Chrome 右上角的三点菜单。",menuStep2:"选择“安装应用”或“添加到主屏幕”。",menuStep3:"确认安装。应用打开后应不再显示浏览器地址栏。"},
    es: {title:"Instalar Fly Infinity",body:"Añade Fly Infinity a tu pantalla de inicio para acceder más rápido con una experiencia similar a una app.",install:"Instalar app",later:"Ahora no",iosTitle:"Añadir Fly Infinity a la pantalla de inicio",iosBody:"Sigue estos pasos para instalar la aplicación web:",step1:"Toca el botón Compartir del navegador.",step2:"Elige “Añadir a pantalla de inicio”.",step3:"Confirma tocando “Añadir”.",done:"Entendido",hint:"Si no aparece esta opción, abre la página en Safari y usa el menú Compartir.",menuTitle:"Instalar Fly Infinity desde Chrome",menuBody:"Chrome todavía no ha abierto el aviso directo de instalación. También puedes instalar desde el menú del navegador:",menuStep1:"Abre el menú de tres puntos de Chrome.",menuStep2:"Elige “Instalar aplicación” o “Añadir a pantalla de inicio”.",menuStep3:"Confirma la instalación. La app debería abrirse sin la barra de direcciones."},
    pt: {title:"Instalar Fly Infinity",body:"Adicione o Fly Infinity à tela inicial para ter acesso rápido com uma experiência semelhante a um aplicativo.",install:"Instalar app",later:"Agora não",iosTitle:"Adicionar Fly Infinity à Tela de Início",iosBody:"Siga estas etapas para instalar o aplicativo web:",step1:"Toque no botão Compartilhar do navegador.",step2:"Escolha “Adicionar à Tela de Início”.",step3:"Confirme tocando em “Adicionar”.",done:"Entendi",hint:"Se essa opção não aparecer, abra esta página no Safari e use o menu Compartilhar.",menuTitle:"Instalar Fly Infinity pelo menu do Chrome",menuBody:"O Chrome ainda não abriu o aviso direto de instalação. Você também pode instalar pelo menu do navegador:",menuStep1:"Abra o menu de três pontos do Chrome.",menuStep2:"Escolha “Instalar app” ou “Adicionar à tela inicial”.",menuStep3:"Confirme a instalação. O app deverá abrir sem a barra de endereço."}
  };

  const getLang = () => {
    const saved = safeGet("fit_lang") || document.documentElement.lang || navigator.language || "en";
    const code = String(saved).toLowerCase().split(/[-_]/)[0];
    return translations[code] ? code : "en";
  };

  let deferredPrompt = null;
  let modal = null;
  let modalKind = null;
  let opened = false;

  const styles = `
    .fi-pwa-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.78);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);opacity:0;animation:fiPwaIn .24s ease forwards}
    .fi-pwa-card{position:relative;width:min(100%,420px);padding:28px 24px 22px;border:1px solid rgba(0,200,150,.58);border-radius:25px;background:linear-gradient(145deg,#111b18,#090d0c 72%);box-shadow:0 22px 70px rgba(0,0,0,.58),inset 0 0 28px rgba(0,200,150,.06);color:#f5f5f5;text-align:center;font-family:inherit}
    .fi-pwa-close{position:absolute;top:10px;inset-inline-end:12px;width:34px;height:34px;border:1px solid rgba(255,255,255,.15);border-radius:50%;background:transparent;color:#cbd5d1;font-size:22px;line-height:1;cursor:pointer}
    .fi-pwa-logo{width:76px;height:76px;object-fit:contain;border-radius:20px;margin:0 auto 14px;display:block;filter:drop-shadow(0 0 14px rgba(0,200,150,.18))}
    .fi-pwa-title{margin:0 22px 10px;color:#e7cb70;font-size:21px;font-weight:800;line-height:1.45}
    .fi-pwa-body{margin:0 0 18px;color:#e2e8e5;font-size:14px;line-height:1.9}
    .fi-pwa-steps{margin:0 0 16px;padding:0;list-style:none;text-align:start;display:grid;gap:9px}
    .fi-pwa-steps li{display:flex;align-items:flex-start;gap:10px;color:#edf4f0;font-size:13px;line-height:1.75}
    .fi-pwa-steps b{flex:0 0 23px;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:rgba(0,200,150,.14);border:1px solid rgba(0,200,150,.5);color:#00d5a1;font-size:12px}
    .fi-pwa-hint{margin:12px 0 0;color:#aab7b1;font-size:11px;line-height:1.7}
    .fi-pwa-actions{display:flex;gap:10px;margin-top:18px}
    .fi-pwa-primary,.fi-pwa-secondary{min-height:46px;padding:10px 15px;border-radius:13px;font:inherit;font-weight:700;font-size:14px;cursor:pointer}
    .fi-pwa-primary{flex:1;border:1px solid #00c896;background:linear-gradient(100deg,#00a87e,#00c896);color:#07110e;box-shadow:0 7px 20px rgba(0,200,150,.18)}
    .fi-pwa-secondary{border:1px solid rgba(255,255,255,.17);background:rgba(255,255,255,.04);color:#d7dfdb}
    .fi-pwa-overlay[dir="rtl"] .fi-pwa-steps{text-align:right}
    @keyframes fiPwaIn{to{opacity:1}}
    @media(prefers-reduced-motion:reduce){.fi-pwa-overlay{animation:none;opacity:1}}
  `;

  function closeModal() {
    if (modal) modal.remove();
    modal = null;
    modalKind = null;
    opened = false;
  }

  function showModal(kind) {
    if (opened || safeGet(INSTALLED_KEY) === "1" || isStandalone()) return;
    opened = true;
    const t = translations[getLang()];
    const rtl = ["fa","ar"].includes(getLang());
    const overlay = document.createElement("div");
    overlay.className = "fi-pwa-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "fi-pwa-title");
    overlay.setAttribute("dir", rtl ? "rtl" : "ltr");
    const style = document.createElement("style");
    style.textContent = styles;
    const card = document.createElement("section");
    card.className = "fi-pwa-card";
    const close = document.createElement("button");
    close.className = "fi-pwa-close";
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", closeModal);
    const logo = document.createElement("img");
    logo.className = "fi-pwa-logo";
    logo.src = new URL("logo.png", baseUrl).href;
    logo.alt = "Fly Infinity";
    const title = document.createElement("h2");
    title.className = "fi-pwa-title";
    title.id = "fi-pwa-title";
    title.textContent = kind === "ios" ? t.iosTitle : (kind === "android-help" ? t.menuTitle : t.title);
    const body = document.createElement("p");
    body.className = "fi-pwa-body";
    body.textContent = kind === "ios" ? t.iosBody : (kind === "android-help" ? t.menuBody : t.body);
    card.append(close, logo, title, body);

    if (kind === "ios" || kind === "android-help") {
      const list = document.createElement("ol");
      list.className = "fi-pwa-steps";
      const stepTexts = kind === "ios" ? [t.step1,t.step2,t.step3] : [t.menuStep1,t.menuStep2,t.menuStep3];
      stepTexts.forEach((line,index) => {
        const li = document.createElement("li");
        const number = document.createElement("b");
        number.textContent = String(index + 1);
        const span = document.createElement("span");
        span.textContent = line;
        li.append(number,span);
        list.append(li);
      });
      const hint = document.createElement("p");
      hint.className = "fi-pwa-hint";
      hint.textContent = kind === "ios" ? t.hint : "";
      card.append(list);
      if (hint.textContent) card.append(hint);
    }

    const actions = document.createElement("div");
    actions.className = "fi-pwa-actions";
    const primary = document.createElement("button");
    primary.type = "button";
    primary.className = "fi-pwa-primary";
    primary.textContent = (kind === "ios" || kind === "android-help") ? t.done : t.install;
    primary.addEventListener("click", async () => {
      if (kind === "ios" || kind === "android-help") {
        closeModal();
        return;
      }
      if (!deferredPrompt) {
        closeModal();
        showModal("android-help");
        return;
      }
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      primary.disabled = true;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        // Only appinstalled or standalone mode confirms installation.\n        // Accepting the browser prompt alone does not prove installation completed.
      } catch (_) {
        // The browser may decline to show its prompt; allow another visit to retry.
      }
      closeModal();
    });
    actions.append(primary);
    if (kind !== "ios") {
      const secondary = document.createElement("button");
      secondary.type = "button";
      secondary.className = "fi-pwa-secondary";
      secondary.textContent = t.later;
      secondary.addEventListener("click", closeModal);
      actions.append(secondary);
    }
    card.append(actions);
    overlay.append(style,card);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeModal(); });
    document.body.append(overlay);
    modal = overlay;
    modalKind = kind;
    close.focus({preventScroll:true});
  }

  window.addEventListener("appinstalled", () => safeSet(INSTALLED_KEY, "1"));

  if (isIOS) {
    window.setTimeout(() => showModal("ios"), 900);
  } else if (isAndroidChrome) {
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredPrompt = event;
      if (modalKind === "android-help") closeModal();
      showModal("android");
    });
    // Provide an install entry point even if Chrome delays beforeinstallprompt.
    window.setTimeout(() => { if (!opened) showModal("android"); }, 1400);
  }

})();
