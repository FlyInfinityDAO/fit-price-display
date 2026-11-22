(function(){
'use strict';
const API=(window.FLY_INFINITY_SOCIAL_API||'https://fly-infinity-social-api.flyinfinityplatform.workers.dev').replace(/\/$/,'');
const $=id=>document.getElementById(id);
const form=$('composerForm'),dialog=$('composerDialog'),grid=$('creationGrid');
const titleInput=$('postTitle'),typeInput=$('postType'),descInput=$('postDescription'),promptInput=$('postPrompt');
const fileInput=$('postMediaFile'),mediaField=$('postMediaField');
const statusNode=$('socialAuthStatus');
const profileDialog=$('socialProfileDialog'),profileForm=$('socialProfileForm');
const reportDialog=$('socialReportDialog'),reportForm=$('socialReportForm');
const copy={
 en:{connectBrowser:'Connect with browser',connectWallet:'Connect wallet',disconnect:'Disconnect',voteAlready:'Already voted',unfollow:'Unfollow',report:'Report',reportTitle:'Report content',reportSubtitle:'Help keep Fly Infinity Social respectful and original.',reportReason:'Reason',reportDetails:'Additional details (optional)',reportSubmit:'Submit report',reportSent:'Thank you. Your report has been recorded.',reasonCopyright:'Copyright or ownership',reasonHarassment:'Harassment',reasonSpam:'Spam or misleading content',reasonUnsafe:'Unsafe content',reasonImpersonation:'Impersonation',reasonOther:'Other',editProfile:'Edit profile',profileTitle:'Creator profile',profileSubtitle:'Shape how the community sees your work.',profileHandle:'Creator handle',profileDisplayName:'Display name',profileBio:'Short bio',profileLanguage:'Preferred language',profileSave:'Save profile',profileCancel:'Cancel',profileSaved:'Your creator profile has been updated.',connecting:'Connecting…',signing:'Sign free login message…',verifying:'Verifying wallet…',connected:'Wallet connected',offline:'Backend not online yet · preview mode remains active',online:'Social backend connected · posts and votes are saved',needWallet:'Connect a registered Fly Infinity Network wallet to continue.',noWallet:'No compatible wallet found. Open this page in your wallet browser or use WalletConnect.',switchChain:'Please switch your wallet to BNB Smart Chain.',mediaFile:'Attach your image or audio file',mediaFileHint:'PNG, JPEG or WebP images up to 15 MB; supported audio up to 30 MB.',uploading:'Uploading media…',publishing:'Publishing creation…',published:'Your creation has been published.',like:'Appreciate',unlike:'Remove appreciation',remix:'Remix',vote:'Vote',voted:'Your vote has been recorded.',following:'Following',follow:'Follow creator',copied:'Prompt copied.',empty:'No community creations have been published yet.',emptyChallenges:'There are no active challenge entries yet.',emptyCreators:'Creator profiles will appear here as people join.',emptyPrompts:'Community prompt templates will appear here.',loginFailed:'Wallet connection was not completed.',apiError:'The Social service could not complete that request.'},
 fa:{connectBrowser:'اتصال با مرورگر',connectWallet:'اتصال کیف پول',disconnect:'قطع اتصال',voteAlready:'قبلاً رأی داده‌اید',unfollow:'لغو دنبال‌کردن',report:'گزارش',reportTitle:'گزارش محتوا',reportSubtitle:'به حفظ احترام و حقوق خالقان در رسانه اجتماعی فلای اینفینیتی کمک کنید.',reportReason:'دلیل گزارش',reportDetails:'توضیحات تکمیلی (اختیاری)',reportSubmit:'ارسال گزارش',reportSent:'سپاسگزاریم. گزارش شما ثبت شد.',reasonCopyright:'نقض حق نشر یا مالکیت',reasonHarassment:'آزار و اذیت',reasonSpam:'هرزنامه یا محتوای گمراه‌کننده',reasonUnsafe:'محتوای نامناسب یا خطرناک',reasonImpersonation:'جعل هویت',reasonOther:'سایر موارد',editProfile:'ویرایش پروفایل',profileTitle:'پروفایل خالق',profileSubtitle:'نحوه نمایش آثار شما به جامعه را تنظیم کنید.',profileHandle:'شناسه خالق',profileDisplayName:'نام نمایشی',profileBio:'معرفی کوتاه',profileLanguage:'زبان ترجیحی',profileSave:'ذخیره پروفایل',profileCancel:'انصراف',profileSaved:'پروفایل شما به‌روزرسانی شد.',connecting:'در حال اتصال…',signing:'امضای پیام ورود رایگان…',verifying:'در حال بررسی کیف پول…',connected:'کیف پول متصل شد',offline:'بک‌اند هنوز فعال نیست · پیش‌نمایش همچنان در دسترس است',online:'بک‌اند رسانه اجتماعی متصل است · آثار و رأی‌ها ذخیره می‌شوند',needWallet:'برای ادامه، کیف پول ثبت‌شده در شبکه فلای اینفینیتی را متصل کنید.',noWallet:'کیف پول سازگار پیدا نشد. صفحه را در مرورگر کیف پول باز کنید یا از WalletConnect استفاده کنید.',switchChain:'لطفاً شبکه کیف پول را روی BNB Smart Chain قرار دهید.',mediaFile:'افزودن فایل تصویر یا صدا',mediaFileHint:'تصویر PNG، JPEG یا WebP تا ۱۵ مگابایت؛ فایل صوتی پشتیبانی‌شده تا ۳۰ مگابایت.',uploading:'در حال بارگذاری رسانه…',publishing:'در حال انتشار اثر…',published:'اثر شما منتشر شد.',like:'پسندیدن',unlike:'حذف پسند',remix:'بازآفرینی',vote:'رأی دادن',voted:'رأی شما ثبت شد.',following:'دنبال می‌کنید',follow:'دنبال‌کردن خالق',copied:'پرامپت کپی شد.',empty:'هنوز اثری از سوی جامعه منتشر نشده است.',emptyChallenges:'هنوز اثری در چالش‌های فعال ثبت نشده است.',emptyCreators:'با پیوستن خالقان، پروفایل آن‌ها اینجا نمایش داده می‌شود.',emptyPrompts:'قالب‌های پرامپت جامعه به‌زودی نمایش داده می‌شوند.',loginFailed:'اتصال کیف پول کامل نشد.',apiError:'سرویس رسانه اجتماعی نتوانست این درخواست را انجام دهد.'},
 ar:{connectBrowser:'الاتصال عبر المتصفح',connectWallet:'اتصال المحفظة',disconnect:'قطع الاتصال',voteAlready:'تم التصويت بالفعل',unfollow:'إلغاء المتابعة',report:'إبلاغ',reportTitle:'الإبلاغ عن محتوى',reportSubtitle:'ساعد في الحفاظ على الاحترام وحقوق المبدعين في Fly Infinity Social.',reportReason:'سبب الإبلاغ',reportDetails:'تفاصيل إضافية (اختياري)',reportSubmit:'إرسال البلاغ',reportSent:'شكرًا لك. تم تسجيل البلاغ.',reasonCopyright:'حقوق النشر أو الملكية',reasonHarassment:'مضايقة',reasonSpam:'رسائل مزعجة أو محتوى مضلل',reasonUnsafe:'محتوى غير آمن',reasonImpersonation:'انتحال الهوية',reasonOther:'أخرى',editProfile:'تعديل الملف الشخصي',profileTitle:'ملف المبدع',profileSubtitle:'حدد كيف يراك المجتمع.',profileHandle:'معرّف المبدع',profileDisplayName:'الاسم المعروض',profileBio:'نبذة قصيرة',profileLanguage:'اللغة المفضلة',profileSave:'حفظ الملف الشخصي',profileCancel:'إلغاء',profileSaved:'تم تحديث ملفك الشخصي.',connecting:'جارٍ الاتصال…',signing:'وقّع رسالة الدخول المجانية…',verifying:'جارٍ التحقق من المحفظة…',connected:'تم الاتصال بالمحفظة',offline:'الخادم غير متاح بعد · المعاينة ما زالت تعمل',online:'خدمة المجتمع متصلة · يتم حفظ المنشورات والتصويتات',needWallet:'اربط محفظة مسجلة في شبكة Fly Infinity للمتابعة.',noWallet:'لم يتم العثور على محفظة متوافقة. افتح الصفحة في متصفح المحفظة أو استخدم WalletConnect.',switchChain:'يرجى التبديل إلى BNB Smart Chain.',mediaFile:'إرفاق صورة أو ملف صوتي',mediaFileHint:'صور PNG أو JPEG أو WebP حتى 15 ميغابايت؛ والصوت المدعوم حتى 30 ميغابايت.',uploading:'جارٍ رفع الوسائط…',publishing:'جارٍ نشر العمل…',published:'تم نشر عملك.',like:'إعجاب',unlike:'إزالة الإعجاب',remix:'إعادة المزج',vote:'تصويت',voted:'تم تسجيل صوتك.',following:'تتابعه',follow:'متابعة المبدع',copied:'تم نسخ المطالبة.',empty:'لم ينشر المجتمع أعمالًا بعد.',emptyChallenges:'لا توجد مشاركات في التحديات النشطة بعد.',emptyCreators:'ستظهر ملفات المبدعين هنا عند انضمامهم.',emptyPrompts:'ستظهر قوالب المطالبات هنا.',loginFailed:'لم يكتمل اتصال المحفظة.',apiError:'تعذر على الخدمة إكمال الطلب.'},
 tr:{connectBrowser:'Tarayıcıyla bağlan',connectWallet:'Cüzdanı bağla',disconnect:'Bağlantıyı kes',voteAlready:'Zaten oy verdiniz',unfollow:'Takibi bırak',report:'Bildir',reportTitle:'İçeriği bildir',reportSubtitle:'Fly Infinity Social’da saygıyı ve üretici haklarını korumaya yardımcı olun.',reportReason:'Bildirim nedeni',reportDetails:'Ek ayrıntılar (isteğe bağlı)',reportSubmit:'Bildirimi gönder',reportSent:'Teşekkürler. Bildiriminiz kaydedildi.',reasonCopyright:'Telif hakkı veya sahiplik',reasonHarassment:'Taciz',reasonSpam:'Spam veya yanıltıcı içerik',reasonUnsafe:'Güvenli olmayan içerik',reasonImpersonation:'Kimliğe bürünme',reasonOther:'Diğer',editProfile:'Profili düzenle',profileTitle:'Üretici profili',profileSubtitle:'Topluluğun çalışmalarınızı nasıl göreceğini belirleyin.',profileHandle:'Üretici kullanıcı adı',profileDisplayName:'Görünen ad',profileBio:'Kısa biyografi',profileLanguage:'Tercih edilen dil',profileSave:'Profili kaydet',profileCancel:'İptal',profileSaved:'Üretici profiliniz güncellendi.',connecting:'Bağlanıyor…',signing:'Ücretsiz giriş mesajını imzalayın…',verifying:'Cüzdan doğrulanıyor…',connected:'Cüzdan bağlandı',offline:'Arka uç henüz çevrimiçi değil · önizleme kullanılabilir',online:'Sosyal servis bağlı · gönderiler ve oylar kaydediliyor',needWallet:'Devam etmek için kayıtlı bir Fly Infinity Network cüzdanı bağlayın.',noWallet:'Uyumlu cüzdan bulunamadı. Sayfayı cüzdan tarayıcısında açın veya WalletConnect kullanın.',switchChain:'Lütfen BNB Smart Chain ağına geçin.',mediaFile:'Görsel veya ses dosyası ekle',mediaFileHint:'15 MB’a kadar PNG, JPEG veya WebP; desteklenen ses dosyaları 30 MB’a kadar.',uploading:'Medya yükleniyor…',publishing:'Çalışma yayınlanıyor…',published:'Çalışmanız yayınlandı.',like:'Beğen',unlike:'Beğeniyi kaldır',remix:'Yeniden düzenle',vote:'Oy ver',voted:'Oyunuz kaydedildi.',following:'Takip ediliyor',follow:'Üreticiyi takip et',copied:'İstem kopyalandı.',empty:'Henüz topluluk çalışması yayınlanmadı.',emptyChallenges:'Aktif yarışmalarda henüz katılım yok.',emptyCreators:'Üreticiler katıldıkça profilleri burada görünecek.',emptyPrompts:'Topluluk istem şablonları burada görünecek.',loginFailed:'Cüzdan bağlantısı tamamlanmadı.',apiError:'Sosyal hizmet isteği tamamlayamadı.'},
 ru:{connectBrowser:'Подключить через браузер',connectWallet:'Подключить кошелёк',disconnect:'Отключить',voteAlready:'Вы уже проголосовали',unfollow:'Отписаться',report:'Пожаловаться',reportTitle:'Пожаловаться на контент',reportSubtitle:'Помогите сохранить уважение и права авторов в Fly Infinity Social.',reportReason:'Причина жалобы',reportDetails:'Дополнительные сведения (необязательно)',reportSubmit:'Отправить жалобу',reportSent:'Спасибо. Ваша жалоба зарегистрирована.',reasonCopyright:'Авторские права или владение',reasonHarassment:'Преследование',reasonSpam:'Спам или вводящий в заблуждение контент',reasonUnsafe:'Небезопасный контент',reasonImpersonation:'Выдача себя за другого',reasonOther:'Другое',editProfile:'Изменить профиль',profileTitle:'Профиль автора',profileSubtitle:'Настройте, как сообщество видит ваши работы.',profileHandle:'Имя автора',profileDisplayName:'Отображаемое имя',profileBio:'Краткая биография',profileLanguage:'Предпочитаемый язык',profileSave:'Сохранить профиль',profileCancel:'Отмена',profileSaved:'Ваш профиль автора обновлён.',connecting:'Подключение…',signing:'Подпишите бесплатное сообщение входа…',verifying:'Проверка кошелька…',connected:'Кошелёк подключён',offline:'Бэкенд пока не запущен · доступен режим предварительного просмотра',online:'Социальный сервис подключён · публикации и голоса сохраняются',needWallet:'Для продолжения подключите кошелёк зарегистрированного владельца Fly Infinity Network.',noWallet:'Совместимый кошелёк не найден. Откройте страницу в браузере кошелька или используйте WalletConnect.',switchChain:'Переключите сеть на BNB Smart Chain.',mediaFile:'Прикрепить изображение или аудио',mediaFileHint:'PNG, JPEG или WebP до 15 МБ; поддерживаемое аудио до 30 МБ.',uploading:'Загрузка медиа…',publishing:'Публикация работы…',published:'Ваша работа опубликована.',like:'Нравится',unlike:'Убрать отметку',remix:'Ремикс',vote:'Голосовать',voted:'Ваш голос записан.',following:'Вы подписаны',follow:'Подписаться на автора',copied:'Промпт скопирован.',empty:'Пока нет опубликованных работ сообщества.',emptyChallenges:'В активных конкурсах пока нет работ.',emptyCreators:'Профили авторов появятся здесь после их регистрации.',emptyPrompts:'Здесь появятся шаблоны сообщества.',loginFailed:'Не удалось завершить подключение кошелька.',apiError:'Социальный сервис не смог выполнить запрос.'},
 zh:{connectBrowser:'通过浏览器连接',connectWallet:'连接钱包',disconnect:'断开连接',voteAlready:'已投过票',unfollow:'取消关注',report:'举报',reportTitle:'举报内容',reportSubtitle:'帮助维护 Fly Infinity Social 的尊重氛围和创作者权益。',reportReason:'举报原因',reportDetails:'补充说明（可选）',reportSubmit:'提交举报',reportSent:'感谢，举报已记录。',reasonCopyright:'版权或所有权',reasonHarassment:'骚扰',reasonSpam:'垃圾或误导性内容',reasonUnsafe:'不安全内容',reasonImpersonation:'冒充他人',reasonOther:'其他',editProfile:'编辑个人资料',profileTitle:'创作者资料',profileSubtitle:'设置社区如何展示您的作品。',profileHandle:'创作者用户名',profileDisplayName:'显示名称',profileBio:'个人简介',profileLanguage:'首选语言',profileSave:'保存资料',profileCancel:'取消',profileSaved:'创作者资料已更新。',connecting:'正在连接…',signing:'请签署免费的登录消息…',verifying:'正在验证钱包…',connected:'钱包已连接',offline:'后端尚未上线 · 预览模式仍可使用',online:'社交服务已连接 · 作品和投票将被保存',needWallet:'请连接已注册 Fly Infinity Network 的钱包以继续。',noWallet:'未找到兼容的钱包。请在钱包浏览器中打开页面或使用 WalletConnect。',switchChain:'请切换到 BNB Smart Chain。',mediaFile:'添加图像或音频文件',mediaFileHint:'PNG、JPEG 或 WebP 图片最大 15 MB；支持的音频最大 30 MB。',uploading:'正在上传媒体…',publishing:'正在发布作品…',published:'作品已发布。',like:'赞赏',unlike:'取消赞赏',remix:'再创作',vote:'投票',voted:'投票已记录。',following:'已关注',follow:'关注创作者',copied:'提示词已复制。',empty:'社区尚未发布作品。',emptyChallenges:'当前挑战尚无作品。',emptyCreators:'创作者加入后，其个人资料将显示在这里。',emptyPrompts:'社区提示词模板将显示在这里。',loginFailed:'钱包连接未完成。',apiError:'社交服务无法完成该请求。'},
 es:{connectBrowser:'Conectar con navegador',connectWallet:'Conectar cartera',disconnect:'Desconectar',voteAlready:'Você já votou',unfollow:'Deixar de seguir',report:'Denunciar',reportTitle:'Denunciar conteúdo',reportSubtitle:'Ajude a preservar o respeito e os direitos dos criadores no Fly Infinity Social.',reportReason:'Motivo da denúncia',reportDetails:'Detalhes adicionais (opcional)',reportSubmit:'Enviar denúncia',reportSent:'Obrigado. Sua denúncia foi registrada.',reasonCopyright:'Direitos autorais ou propriedade',reasonHarassment:'Assédio',reasonSpam:'Spam ou conteúdo enganoso',reasonUnsafe:'Conteúdo inseguro',reasonImpersonation:'Falsidade ideológica',reasonOther:'Outro',voteAlready:'Ya has votado',unfollow:'Dejar de seguir',report:'Denunciar',reportTitle:'Denunciar contenido',reportSubtitle:'Ayuda a mantener el respeto y los derechos de los creadores en Fly Infinity Social.',reportReason:'Motivo',reportDetails:'Detalles adicionales (opcional)',reportSubmit:'Enviar denuncia',reportSent:'Gracias. Tu denuncia ha sido registrada.',reasonCopyright:'Derechos de autor o propiedad',reasonHarassment:'Acoso',reasonSpam:'Spam o contenido engañoso',reasonUnsafe:'Contenido no seguro',reasonImpersonation:'Suplantación de identidad',reasonOther:'Otro',editProfile:'Editar perfil',profileTitle:'Perfil do criador',profileSubtitle:'Defina como a comunidade vê seus trabalhos.',profileHandle:'Identificador do criador',profileDisplayName:'Nome de exibição',profileBio:'Breve biografia',profileLanguage:'Idioma preferido',profileSave:'Salvar perfil',profileCancel:'Cancelar',profileSaved:'Seu perfil de criador foi atualizado.',editProfile:'Editar perfil',profileTitle:'Perfil del creador',profileSubtitle:'Configura cómo la comunidad ve tus trabajos.',profileHandle:'Usuario del creador',profileDisplayName:'Nombre visible',profileBio:'Biografía breve',profileLanguage:'Idioma preferido',profileSave:'Guardar perfil',profileCancel:'Cancelar',profileSaved:'Tu perfil de creador se ha actualizado.',connecting:'Conectando…',signing:'Firma el mensaje gratuito de acceso…',verifying:'Verificando cartera…',connected:'Cartera conectada',offline:'El backend aún no está activo · la vista previa sigue disponible',online:'Servicio social conectado · las publicaciones y los votos se guardan',needWallet:'Conecta una cartera registrada en Fly Infinity Network para continuar.',noWallet:'No se encontró una cartera compatible. Abre esta página en el navegador de tu cartera o usa WalletConnect.',switchChain:'Cambia a BNB Smart Chain.',mediaFile:'Adjuntar imagen o audio',mediaFileHint:'Imágenes PNG, JPEG o WebP hasta 15 MB; audio compatible hasta 30 MB.',uploading:'Subiendo contenido…',publishing:'Publicando creación…',published:'Tu creación se ha publicado.',like:'Apreciar',unlike:'Quitar apreciación',remix:'Reinterpretar',vote:'Votar',voted:'Tu voto se ha registrado.',following:'Siguiendo',follow:'Seguir creador',copied:'Prompt copiado.',empty:'La comunidad aún no ha publicado creaciones.',emptyChallenges:'Todavía no hay participaciones en los retos activos.',emptyCreators:'Los perfiles aparecerán aquí cuando se unan los creadores.',emptyPrompts:'Aquí aparecerán las plantillas de prompts de la comunidad.',loginFailed:'No se completó la conexión de la cartera.',apiError:'El servicio social no pudo completar la solicitud.'},
 pt:{connectBrowser:'Conectar pelo navegador',connectWallet:'Conectar carteira',disconnect:'Desconectar',connecting:'Conectando…',signing:'Assine a mensagem gratuita de acesso…',verifying:'Verificando carteira…',connected:'Carteira conectada',offline:'O backend ainda não está ativo · a prévia continua disponível',online:'Serviço social conectado · publicações e votos são salvos',needWallet:'Conecte uma carteira registrada na Fly Infinity Network para continuar.',noWallet:'Nenhuma carteira compatível encontrada. Abra esta página no navegador da carteira ou use WalletConnect.',switchChain:'Mude para BNB Smart Chain.',mediaFile:'Anexar imagem ou áudio',mediaFileHint:'Imagens PNG, JPEG ou WebP até 15 MB; áudio compatível até 30 MB.',uploading:'Enviando mídia…',publishing:'Publicando criação…',published:'Sua criação foi publicada.',like:'Apreciar',unlike:'Remover apreciação',remix:'Remixar',vote:'Votar',voted:'Seu voto foi registrado.',following:'Seguindo',follow:'Seguir criador',copied:'Prompt copiado.',empty:'A comunidade ainda não publicou criações.',emptyChallenges:'Ainda não há entradas nos desafios ativos.',emptyCreators:'Os perfis aparecerão aqui quando os criadores entrarem.',emptyPrompts:'Os modelos de prompts da comunidade aparecerão aqui.',loginFailed:'A conexão da carteira não foi concluída.',apiError:'O serviço social não conseguiu concluir a solicitação.'}
};
const lang=()=>document.documentElement.lang||'en';
const t=key=>(copy[lang()]||copy.en)[key]||(copy.en[key]||key);
let apiReady=false,token='',wallet='',profile=null,challenges=[];
function toast(message){const node=$('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(node._socialTimer);node._socialTimer=setTimeout(()=>node.classList.remove('show'),2600);}
function status(message,isError=false){if(!statusNode)return;statusNode.textContent=message;statusNode.classList.toggle('error',!!isError);}
function storageGet(key){try{return sessionStorage.getItem(key)||'';}catch(error){return '';}}
function storageSet(key,value){try{sessionStorage.setItem(key,value);}catch(error){console.warn('[Fly Infinity Social] Session storage is unavailable.');}}
function storageRemove(key){try{sessionStorage.removeItem(key);}catch(error){}}
function translateSocial(){document.querySelectorAll('[data-social-t]').forEach(node=>{const key=node.dataset.socialT;if(copy[lang()]&&copy[lang()][key])node.textContent=copy[lang()][key];});if(profile)paintWallet();}
async function api(path,options={}){
 const headers=new Headers(options.headers||{});
 if(token)headers.set('Authorization','Bearer '+token);
 let body=options.body;
 if(body&&typeof body==='object'&&!(body instanceof Blob)&&!(body instanceof ArrayBuffer)&&!(body instanceof FormData)){
  headers.set('Content-Type','application/json');body=JSON.stringify(body);
 }
 const response=await fetch(API+path,{...options,headers,body,cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||t('apiError'));
 return data;
}
function toHex(value){return '0x'+Array.from(new TextEncoder().encode(value),b=>b.toString(16).padStart(2,'0')).join('');}
async function providerFor(mode){
 if(mode==='wallet'&&typeof window.fiConnectWalletConnect==='function')return await window.fiConnectWalletConnect();
 if(mode==='browser'&&typeof window.fiSelectWalletProvider==='function')return await window.fiSelectWalletProvider();
 if(window.ethereum&&typeof window.ethereum.request==='function'){
  await window.ethereum.request({method:'eth_requestAccounts'});return window.ethereum;
 }
 throw new Error(t('noWallet'));
}
async function switchToBsc(provider){
 let chain=await provider.request({method:'eth_chainId'});
 if(Number.parseInt(chain,16)===56)return;
 try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x38'}]});}
 catch(error){throw new Error(t('switchChain'));}
 chain=await provider.request({method:'eth_chainId'});
 if(Number.parseInt(chain,16)!==56)throw new Error(t('switchChain'));
}
function paintWallet(){
 const address=wallet;
 $('connectSocialBrowser').hidden=!!address;
 $('connectSocialWallet').hidden=!!address;
 $('disconnectSocialWallet').hidden=!address;
 $('editSocialProfile').hidden=!address;
 $('editSocialProfile').textContent=t('editProfile');
 if(address){
  const short=address.slice(0,6)+'…'+address.slice(-4);
  $('disconnectSocialWallet').textContent=(profile?.handle?'@'+profile.handle:short)+' · '+t('disconnect');
  status((profile?.display_name||short)+' · '+t('connected'));
 }else{
  $('connectSocialBrowser').textContent=t('connectBrowser');
  $('connectSocialWallet').textContent=t('connectWallet');
 }
}
async function connect(mode){
 const buttons=[$('connectSocialBrowser'),$('connectSocialWallet')];
 buttons.forEach(button=>button.disabled=true);
 status(t('connecting'));
 try{
  const provider=await providerFor(mode);
  await switchToBsc(provider);
  const accounts=await provider.request({method:'eth_accounts'});
  if(!Array.isArray(accounts)||!accounts[0])throw new Error(t('noWallet'));
  const address=accounts[0];
  status(t('signing'));
  const challenge=await api('/api/auth/challenge',{method:'POST',body:{address}});
  const signature=await provider.request({method:'personal_sign',params:[toHex(challenge.message),address]});
  status(t('verifying'));
  const verified=await api('/api/auth/verify',{method:'POST',body:{address,nonce:challenge.nonce,signature}});
  token=verified.token;wallet=verified.wallet;profile=verified.profile;
  storageSet('fly-social-token',token);
  storageSet('fly-social-wallet',wallet);
  paintWallet();
  const loaded=await Promise.allSettled([loadFeed(),loadChallenges(),loadCreators(),loadPrompts()]);
  if(loaded.some(item=>item.status==='rejected'))console.warn('[Fly Infinity Social] Authentication succeeded, but a community section could not be refreshed.');
  status((profile?.display_name||wallet)+' · '+t('connected'));
  toast(t('connected'));
  window.dispatchEvent(new CustomEvent('fly-social:authenticated',{detail:{wallet,profile}}));
 }catch(error){status(error.message||t('loginFailed'),true);toast(error.message||t('loginFailed'));}
 finally{buttons.forEach(button=>button.disabled=false);}
}
async function disconnect(){
 try{if(token)await api('/api/auth/logout',{method:'POST'});}catch(error){}
 token='';wallet='';profile=null;
 storageRemove('fly-social-token');storageRemove('fly-social-wallet');
 paintWallet();status(t('needWallet'));
}
async function restoreSession(){
 try{
  token=storageGet('fly-social-token');
  wallet=storageGet('fly-social-wallet');
  if(!token){paintWallet();return;}
  const me=await api('/api/me');wallet=me.wallet;profile=me.profile;paintWallet();
 }catch(error){
  token='';wallet='';profile=null;storageRemove('fly-social-token');storageRemove('fly-social-wallet');paintWallet();
 }
}
function mediaElement(post,challenge=false){
 const wrap=document.createElement('div');wrap.className='artwork';
 if(post.mediaType==='image'&&post.mediaUrl){
  const img=document.createElement('img');img.className='social-artwork-image';img.src=post.mediaUrl;img.alt=post.title;img.loading='lazy';wrap.append(img);
 }else if(post.mediaType==='audio'&&post.mediaUrl){
  wrap.classList.add('art-audio');
  const player=document.createElement('audio');player.className='social-artwork-audio';player.controls=true;player.preload='none';player.src=post.mediaUrl;wrap.append(player);
 }else{
  wrap.classList.add('social-prompt-art');const icon=document.createElement('span');icon.textContent=post.mediaType==='prompt'?'✧':'♫';wrap.append(icon);
 }
 if(!challenge){
  const overlay=document.createElement('div');overlay.className='art-overlay';
  const tag=document.createElement('span');tag.className='art-tag';tag.textContent=post.mediaType.toUpperCase();
  overlay.append(tag);wrap.append(overlay);
 }
 return wrap;
}
function postCard(post){
 const article=document.createElement('article');article.className='creation-card';article.dataset.kind=post.mediaType;article.dataset.postId=post.id;
 const art=mediaElement(post,false);
 const body=document.createElement('div');body.className='card-body';
 const creator=document.createElement('div');creator.className='creator-line';
 const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=(post.creator.displayName||'FI').slice(0,2).toUpperCase();
 const creatorName=document.createElement('span');creatorName.textContent=(post.creator.displayName||post.creator.handle)+' · @'+post.creator.handle;
 creator.append(avatar,creatorName);
 const title=document.createElement('h3');title.textContent=post.title;
 const description=document.createElement('p');description.textContent=post.description||'';
 const actions=document.createElement('div');actions.className='card-actions';
 const left=document.createElement('div');left.className='action-group';
 const like=document.createElement('button');like.type='button';like.className='mini-btn social-live-button';like.dataset.socialLike=post.id;like.setAttribute('aria-pressed',String(post.likedByMe));
 like.innerHTML=(post.likedByMe?'♥':'♡')+' <span data-live-count>'+post.likes+'</span>';
 const remix=document.createElement('button');remix.type='button';remix.className='mini-btn social-live-button';remix.dataset.socialRemix=post.id;remix.textContent=t('remix');
 left.append(like,remix);
 const credit=document.createElement('span');credit.className='sort-label';
 credit.textContent=post.source?'Inspired by '+(post.source.title||'an original creation'):'Fly Infinity Social';
 const report=document.createElement('button');report.type='button';report.className='mini-btn social-report-button';report.dataset.socialReportPost=post.id;report.textContent=t('report');
 actions.append(left,credit,report);
 body.append(creator,title,description);
 if(post.prompt){const prompt=document.createElement('div');prompt.className='prompt-line';prompt.textContent=post.prompt;body.append(prompt);}
 if(post.source){const source=document.createElement('small');source.className='social-source-credit';source.textContent='Remix · '+post.source.title;body.append(source);}
 body.append(actions);article.append(art,body);return article;
}
async function loadFeed(){
 const result=await api('/api/feed?limit=24');
 grid.replaceChildren();
 if(!result.posts.length){const empty=document.createElement('div');empty.className='social-empty';empty.textContent=t('empty');grid.append(empty);return;}
 result.posts.forEach(post=>grid.append(postCard(post)));
 document.querySelector('[data-filter="all"]')?.click();
}
function challengeEntry(challenge,post){
 const card=document.createElement('article');card.className='challenge-entry';
 card.append(mediaElement(post,true));
 const creator=document.createElement('span');creator.className='creator-line';creator.textContent=(post.creator.displayName||post.creator.handle)+' · @'+post.creator.handle;
 const title=document.createElement('h3');title.textContent=post.title;
 const desc=document.createElement('p');desc.textContent=post.description||'';
 const actions=document.createElement('div');actions.className='card-actions';
 const count=document.createElement('span');count.className='vote-count';count.textContent='★ '+post.votes+' '+t('vote');
 const vote=document.createElement('button');vote.type='button';vote.className='mini-btn social-live-button';vote.dataset.socialVote=challenge.id;vote.dataset.postId=post.id;vote.disabled=!!post.votedByMe;vote.textContent=t(post.votedByMe?'voteAlready':'vote');
 actions.append(count,vote);card.append(creator,title,desc,actions);return card;
}
async function loadChallenges(){
 const result=await api('/api/challenges');challenges=result.challenges||[];
 const gridNode=document.querySelector('#view-challenges .challenge-grid');
 gridNode.replaceChildren();
 for(const challenge of challenges){for(const post of challenge.entries)gridNode.append(challengeEntry(challenge,post));}
 if(!gridNode.children.length){const empty=document.createElement('div');empty.className='social-empty';empty.textContent=t('emptyChallenges');gridNode.append(empty);}
 const image=challenges.find(item=>item.mediaType==='image');
 const audio=challenges.find(item=>item.mediaType==='audio');
 ['joinChallenge','joinChallenge2'].forEach(id=>{const button=$(id);if(button)button.dataset.challengeId=image?.id||'';});
 const audioButton=$('joinAudioChallenge2');if(audioButton)audioButton.dataset.challengeId=audio?.id||'';
}
async function loadCreators(){
 const result=await api('/api/creators?limit=24');const gridNode=document.querySelector('#view-creators .creator-grid');gridNode.replaceChildren();
 for(const creator of result.creators||[]){
  const card=document.createElement('article');card.className='creator-profile';
  const avatar=document.createElement('div');avatar.className='avatar';avatar.textContent=(creator.display_name||'FI').slice(0,2).toUpperCase();
  const name=document.createElement('h3');name.textContent=creator.display_name;
  const handle=document.createElement('div');handle.className='role';handle.textContent='@'+creator.handle;
  const bio=document.createElement('p');bio.textContent=creator.bio||'';
  const metrics=document.createElement('div');metrics.className='creator-metrics';
  const works=document.createElement('div');const worksNum=document.createElement('b');worksNum.textContent=creator.post_count;const worksLabel=document.createElement('span');worksLabel.textContent='Works';works.append(worksNum,worksLabel);
  const followers=document.createElement('div');const followersNum=document.createElement('b');followersNum.textContent=creator.follower_count;const followersLabel=document.createElement('span');followersLabel.textContent='Followers';followers.append(followersNum,followersLabel);
  metrics.append(works,followers);
  const follow=document.createElement('button');follow.type='button';follow.className='mini-btn social-follow-button';follow.dataset.socialFollow=creator.wallet_address;follow.dataset.following=String(Boolean(creator.following_by_me));follow.textContent=t(creator.following_by_me?'unfollow':'follow');
  const report=document.createElement('button');report.type='button';report.className='mini-btn social-report-button';report.dataset.socialReportCreator=creator.wallet_address;report.textContent=t('report');
  card.append(avatar,name,handle,bio,metrics);if(wallet&&creator.wallet_address.toLowerCase()!==wallet.toLowerCase())card.append(follow);card.append(report);gridNode.append(card);
 }
 if(!gridNode.children.length){const empty=document.createElement('div');empty.className='social-empty';empty.textContent=t('emptyCreators');gridNode.append(empty);}
}
async function loadPrompts(){
 const result=await api('/api/prompts?limit=30');const gridNode=document.querySelector('#view-prompts .prompt-grid');gridNode.replaceChildren();
 for(const post of result.posts||[]){
  const card=document.createElement('article');card.className='prompt-card';
  const tag=document.createElement('span');tag.className='art-tag';tag.textContent='PROMPT';
  const title=document.createElement('h3');title.textContent=post.title;
  const by=document.createElement('p');by.textContent='@'+post.creator.handle;
  const text=document.createElement('div');text.className='prompt-text';text.textContent=post.prompt||post.description;
  const copyButton=document.createElement('button');copyButton.type='button';copyButton.className='mini-btn';copyButton.textContent='Copy prompt';copyButton.dataset.socialCopy=post.prompt||post.description;
  card.append(tag,title,by,text,copyButton);gridNode.append(card);
 }
 if(!gridNode.children.length){const empty=document.createElement('div');empty.className='social-empty';empty.textContent=t('emptyPrompts');gridNode.append(empty);}
}
function openRemix(postId){
 api('/api/posts/'+encodeURIComponent(postId)).then(({post})=>{
  form.reset();form.dataset.sourcePostId=post.id;form.dataset.challengeId='';
  titleInput.value=post.title+' — Remix';typeInput.value=post.mediaType;
  descInput.value='Inspired by @'+post.creator.handle+' · '+post.title;
  promptInput.value=post.prompt||'';
  const attribution=$('attribution');attribution.textContent='Remix inspired by @'+post.creator.handle+' — original work: '+post.title+'. Original creator attribution is stored with this post.';attribution.classList.add('show');
  if(typeInput.value==='prompt'){mediaField.hidden=true;}else{mediaField.hidden=false;}
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','open');
 }).catch(error=>toast(error.message));
}
async function publish(e){
 e.preventDefault();e.stopImmediatePropagation();
 if(!token){toast(t('needWallet'));return;}
 const mediaType=typeInput.value,file=fileInput.files?.[0]||null;
 let mediaKey=null;
 const button=form.querySelector('button[type="submit"]');button.disabled=true;
 try{
  if(mediaType!=='prompt'){
   if(!file)throw new Error(t('mediaFile'));
   status(t('uploading'));
   const uploaded=await api('/api/media/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});
   mediaKey=uploaded.mediaKey;
  }
  status(t('publishing'));
  const post=await api('/api/posts',{method:'POST',body:{
   title:titleInput.value.trim(),mediaType,description:descInput.value.trim(),prompt:promptInput.value.trim(),
   mediaKey,sourcePostId:form.dataset.sourcePostId||null,challengeId:form.dataset.challengeId||null
  }});
  form.reset();form.dataset.challengeId='';form.dataset.sourcePostId='';$('attribution').classList.remove('show');
  if(dialog.open)dialog.close();status(t('published'));toast(t('published'));
  await Promise.all([loadFeed(),loadChallenges()]);
 }catch(error){status(error.message,true);toast(error.message);}
 finally{button.disabled=false;}
}
async function handleClick(event){
 const reportPost=event.target.closest('[data-social-report-post]');
 const reportCreator=event.target.closest('[data-social-report-creator]');
 if(reportPost||reportCreator){
  event.preventDefault();event.stopImmediatePropagation();
  if(!token){toast(t('needWallet'));return;}
  reportForm.dataset.targetType=reportPost?'post':'creator';
  reportForm.dataset.targetId=reportPost?reportPost.dataset.socialReportPost:reportCreator.dataset.socialReportCreator;
  reportForm.reset();
  if(reportDialog.showModal)reportDialog.showModal();else reportDialog.setAttribute('open','open');
  return;
 }
 const like=event.target.closest('[data-social-like]');
 if(like){
  event.preventDefault();event.stopImmediatePropagation();if(!token){toast(t('needWallet'));return;}
  like.disabled=true;
  try{
   const id=like.dataset.socialLike,was=like.getAttribute('aria-pressed')==='true';
   const result=await api('/api/posts/'+encodeURIComponent(id)+'/like',{method:was?'DELETE':'POST'});
   like.setAttribute('aria-pressed',String(result.liked));like.firstChild.textContent=result.liked?'♥ ':'♡ ';
   like.querySelector('[data-live-count]').textContent=result.likes;
  }catch(error){toast(error.message);}finally{like.disabled=false;}
  return;
 }
 const vote=event.target.closest('[data-social-vote]');
 if(vote){
  event.preventDefault();event.stopImmediatePropagation();if(!token){toast(t('needWallet'));return;}
  vote.disabled=true;
  try{
   await api('/api/challenges/'+encodeURIComponent(vote.dataset.socialVote)+'/vote',{method:'POST',body:{postId:vote.dataset.postId}});
   toast(t('voted'));await loadChallenges();
  }catch(error){vote.disabled=false;toast(error.message);}
  return;
 }
 const remix=event.target.closest('[data-social-remix]');
 if(remix){event.preventDefault();event.stopImmediatePropagation();openRemix(remix.dataset.socialRemix);return;}
 const follow=event.target.closest('[data-social-follow]');
 if(follow){
  event.preventDefault();event.stopImmediatePropagation();if(!token){toast(t('needWallet'));return;}
  follow.disabled=true;
  try{
   const wasFollowing=follow.dataset.following==='true';
   const result=await api('/api/creators/'+encodeURIComponent(follow.dataset.socialFollow)+'/follow',{method:wasFollowing?'DELETE':'POST'});
   follow.dataset.following=String(result.following);
   follow.textContent=result.following?t('unfollow'):t('follow');
  }catch(error){toast(error.message);}finally{follow.disabled=false;}
  return;
 }
 const copyButton=event.target.closest('[data-social-copy]');
 if(copyButton){
  event.preventDefault();event.stopImmediatePropagation();
  try{await navigator.clipboard.writeText(copyButton.dataset.socialCopy||'');toast(t('copied'));}
  catch(error){toast(t('apiError'));}
 }
}
document.addEventListener('click',handleClick,true);
form.addEventListener('submit',event=>{if(apiReady)publish(event);},true);
function syncMediaField(){
 const promptOnly=typeInput.value==='prompt';
 mediaField.hidden=!apiReady||promptOnly;
 fileInput.required=apiReady&&!promptOnly;
 fileInput.accept=typeInput.value==='image'?'image/png,image/jpeg,image/webp':'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac';
 $('postMediaStatus').textContent=t('mediaFileHint');
}
typeInput.addEventListener('change',syncMediaField);
document.addEventListener('click',event=>{
 const open=event.target.closest('#openComposer,#heroPublish,#publishFromFeed,#joinChallenge,#joinChallenge2,#joinAudioChallenge2');
 if(open)queueMicrotask(syncMediaField);
});
document.addEventListener('click',event=>{
 const challengeButton=event.target.closest('#joinChallenge,#joinChallenge2,#joinAudioChallenge2');
 if(challengeButton){form.dataset.challengeId=challengeButton.dataset.challengeId||'';form.dataset.sourcePostId='';}
 const openButton=event.target.closest('#openComposer,#heroPublish,#publishFromFeed');
 if(openButton){form.dataset.challengeId='';form.dataset.sourcePostId='';}
},true);
$('connectSocialBrowser').addEventListener('click',()=>connect('browser'));
$('connectSocialWallet').addEventListener('click',()=>connect('wallet'));
$('disconnectSocialWallet').addEventListener('click',disconnect);
$('editSocialProfile').addEventListener('click',()=>{
 if(!profile)return;
 $('socialProfileHandle').value=profile.handle||'';
 $('socialProfileName').value=profile.display_name||'';
 $('socialProfileBio').value=profile.bio||'';
 $('socialProfileLanguage').value=profile.language||lang();
 if(profileDialog.showModal)profileDialog.showModal();else profileDialog.setAttribute('open','open');
});
$('closeSocialProfile').addEventListener('click',()=>profileDialog.close());
$('cancelSocialProfile').addEventListener('click',()=>profileDialog.close());
profileDialog.addEventListener('click',event=>{if(event.target===profileDialog)profileDialog.close();});
profileForm.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!token)return;
 const save=profileForm.querySelector('button[type="submit"]');save.disabled=true;
 try{
  const result=await api('/api/profile',{method:'PUT',body:{
   handle:$('socialProfileHandle').value.trim(),
   displayName:$('socialProfileName').value.trim(),
   bio:$('socialProfileBio').value.trim(),
   language:$('socialProfileLanguage').value
  }});
  profile=result.profile;paintWallet();profileDialog.close();toast(t('profileSaved'));
  await loadCreators();
 }catch(error){status(error.message,true);toast(error.message);}
 finally{save.disabled=false;}
});
$('closeSocialReport').addEventListener('click',()=>reportDialog.close());
$('cancelSocialReport').addEventListener('click',()=>reportDialog.close());
reportDialog.addEventListener('click',event=>{if(event.target===reportDialog)reportDialog.close();});
reportForm.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!token)return;
 const submit=reportForm.querySelector('button[type="submit"]');submit.disabled=true;
 try{
  await api('/api/reports',{method:'POST',body:{
   targetType:reportForm.dataset.targetType,
   targetId:reportForm.dataset.targetId,
   reason:$('socialReportReason').value,
   details:$('socialReportDetails').value.trim()
  }});
  reportDialog.close();toast(t('reportSent'));
 }catch(error){toast(error.message);}
 finally{submit.disabled=false;}
});
if(window.ethereum&&window.ethereum.on){
 window.ethereum.on('accountsChanged',()=>{if(token)disconnect();});
 window.ethereum.on('chainChanged',()=>{if(token)disconnect();});
}
document.addEventListener('fi-language-updated',translateSocial);
async function initialize(){
 try{
  const health=await fetch(API+'/api/health',{cache:'no-store'});
  if(!health.ok)throw new Error('API not ready');
  const result=await health.json();
  if(!result.ok||result.service!=='Fly Infinity Social API')throw new Error('API not ready');
  apiReady=true;document.body.classList.add('social-api-online');
  document.querySelector('.social-wallet-actions').hidden=false;
  mediaField.hidden=typeInput.value==='prompt';
  fileInput.accept=typeInput.value==='audio'?'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac':'image/png,image/jpeg,image/webp';
  fileInput.required=typeInput.value!=='prompt';
  $('postMediaStatus').textContent=t('mediaFileHint');
  const preview=document.querySelector('.preview-strip');
  if(preview){preview.textContent=t('online');preview.classList.add('is-live');}
  const footer=document.querySelector('.footer-note');if(footer)footer.textContent=t('online');
  await restoreSession();
  const results=await Promise.allSettled([loadFeed(),loadChallenges(),loadCreators(),loadPrompts()]);
  if(results.some(item=>item.status==='rejected'))console.warn('[Fly Infinity Social] One or more community sections could not be loaded.');
 }catch(error){
  apiReady=false;document.querySelector('.social-wallet-actions').hidden=true;mediaField.hidden=true;
  status(t('offline'));
 }
}
translateSocial();
initialize();
})();