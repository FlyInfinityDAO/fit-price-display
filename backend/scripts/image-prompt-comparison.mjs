import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = (process.env.IMAGE_TEST_URL || '').replace(/\/$/, '');
const authKey = process.env.IMAGE_TEST_AUTH_KEY || '';
if (!baseUrl || !authKey) throw new Error('IMAGE_TEST_URL and IMAGE_TEST_AUTH_KEY are required');

const cases = [
  {
    id: '01-watch',
    fa: 'یک عکس تبلیغاتی بسیار واقع‌گرایانه از یک ساعت مچی لوکس روی سنگ مرمر مشکی، نورپردازی طلایی سینمایی، پس‌زمینه مینیمال، جزئیات ظریف فلز، بدون نوشته و لوگو.',
    en: 'A highly photorealistic luxury wristwatch product advertisement on black marble, cinematic golden lighting, minimalist background, fine metal details, no text or logo.'
  },
  {
    id: '02-isfahan-square',
    fa: 'نمای سینمایی شبانه از میدان نقش جهان اصفهان، معماری تاریخی ایرانی، انعکاس نورها روی سنگ‌فرش خیس، نور گرم و مه لطیف، بدون نوشته.',
    en: 'A cinematic nighttime view of Naqsh-e Jahan Square in Isfahan, historic Persian architecture, lights reflected on wet paving stones, warm illumination and subtle mist, no text.'
  },
  {
    id: '03-fashion-portrait',
    fa: 'پرتره ادیتوریال یک زن خیالی با لباس مدرن و پوشیده، نور نرم استودیویی، پس‌زمینه خاکستری ساده، عکاسی مد حرفه‌ای، جزئیات طبیعی پوست.',
    en: 'An editorial portrait of a fictional woman wearing modern modest fashion, soft studio lighting, simple grey background, professional fashion photography, natural skin detail.'
  },
  {
    id: '04-fantasy-castle',
    fa: 'یک منظره فانتزی از قلعه‌ای شناور میان ابرها هنگام غروب، آبشارهای نورانی، رنگ‌های بنفش و طلایی، ترکیب‌بندی سینمایی.',
    en: 'A fantasy landscape of a floating castle among clouds at sunset, luminous waterfalls, violet and gold colors, cinematic composition.'
  },
  {
    id: '05-blockchain-ad',
    fa: 'تصویر مینیمال و حرفه‌ای برای تبلیغ فناوری بلاکچین، یک مکعب شیشه‌ای شفاف با خطوط نورانی فیروزه‌ای و طلایی، پس‌زمینه مشکی، فضای خالی کافی.',
    en: 'A professional minimalist blockchain technology advertisement, a transparent glass cube with glowing turquoise and gold lines, black background, ample negative space.'
  },
  {
    id: '06-rose-macro',
    fa: 'عکاسی ماکرو از یک گل رز قرمز با قطرات شبنم، پس‌زمینه تیره و محو، نور طبیعی ملایم، جزئیات بسیار بالا.',
    en: 'Macro photography of a red rose with dew drops, dark blurred background, gentle natural light, extremely high detail.'
  },
  {
    id: '07-coffee-ad',
    fa: 'تصویر تبلیغاتی یک فنجان قهوه روی میز چوبی کنار پنجره بارانی، بخار ملایم، نور صبحگاهی گرم، حس آرامش و واقع‌گرایی.',
    en: 'An advertising image of a cup of coffee on a wooden table beside a rainy window, gentle steam, warm morning light, calm photorealistic mood.'
  },
  {
    id: '08-robot',
    fa: 'تصویرسازی سه‌بعدی از یک ربات کوچک دوست‌داشتنی با بدنه سفید و طلایی در آزمایشگاه آینده‌نگر، نورپردازی سینمایی.',
    en: 'A 3D illustration of a charming small robot with a white and gold body in a futuristic laboratory, cinematic lighting.'
  },
  {
    id: '09-abstract-poster',
    fa: 'یک پوستر گرافیکی انتزاعی با اشکال هندسی منظم، رنگ‌های سرمه‌ای، فیروزه‌ای و طلایی، طراحی لوکس و مدرن، بدون متن.',
    en: 'An abstract graphic poster with structured geometric shapes, navy, turquoise and gold colors, luxurious modern design, no text.'
  },
  {
    id: '10-northern-forest',
    fa: 'یک منظره طبیعی از جنگل مه‌آلود در شمال ایران، درختان بلند و رودخانه باریک، نور ملایم سپیده‌دم، عکاسی حرفه‌ای طبیعت.',
    en: 'A natural landscape of a misty forest in northern Iran, tall trees and a narrow river, soft dawn light, professional landscape photography.'
  }
];

// The first two prompt pairs were already generated and saved in earlier runs.
const startIndex = Number(process.env.IMAGE_TEST_START_INDEX || 0);
const remainingCases = cases.slice(startIndex);
if (remainingCases.length === 0) {
  console.log('All comparison cases are already covered; no image requests sent.');
  process.exit(0);
}
const outDir = path.resolve('image-test-results');
await fs.mkdir(outDir, { recursive: true });
const manifest = {
  model: '@cf/black-forest-labs/flux-2-klein-4b',
  dimensions: '512x512',
  startedAt: new Date().toISOString(),
  sameSeedPerPair: true,
  results: []
};

let failed = false;
for (let i = 0; i < remainingCases.length && !failed; i++) {
  const item = remainingCases[i];
  const originalIndex = cases.findIndex(entry => entry.id === item.id);
  const seed = 20261121 + originalIndex;
  for (const language of ['fa', 'en']) {
    const prompt = item[language];
    const record = {
      id: item.id,
      language,
      prompt,
      seed,
      status: 'pending'
    };
    try {
      let response;
      let responseText = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        response = await fetch(baseUrl + '/api/image/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Fly-Image-Test-Key': authKey
          },
          body: JSON.stringify({ prompt, seed })
        });
        if (response.ok) break;
        responseText = (await response.text()).slice(0, 1000);
        if (![429, 502, 503, 504].includes(response.status) || attempt === 3) break;
        const delayMs = attempt * 5000;
        console.log('Temporary image API error ' + response.status + ' for ' + item.id + ' [' + language + ']; retrying in ' + delayMs + ' ms');
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      record.httpStatus = response.status;
      record.model = response.headers.get('X-Image-Model');
      record.width = Number(response.headers.get('X-Image-Width') || 0);
      record.height = Number(response.headers.get('X-Image-Height') || 0);
      record.quotaRemaining = response.headers.get('X-Image-Quota-Remaining');
      record.responseSeed = response.headers.get('X-Image-Seed');

      if (!response.ok) {
        record.status = 'failed';
        record.error = responseText || (await response.text()).slice(0, 1000);
        manifest.results.push(record);
        failed = true;
        break;
      }

      const contentType = (response.headers.get('content-type') || '').split(';')[0];
      const ext = contentType === 'image/png' ? 'png' :
        contentType === 'image/jpeg' ? 'jpg' :
        contentType === 'image/webp' ? 'webp' : '';
      if (!ext) {
        record.status = 'failed';
        record.error = 'Unsupported content-type: ' + contentType;
        manifest.results.push(record);
        failed = true;
        break;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 12 * 1024 * 1024) {
        record.status = 'failed';
        record.error = 'Image bytes missing or larger than 12 MB';
        manifest.results.push(record);
        failed = true;
        break;
      }

      const filename = item.id + '-' + language + '.' + ext;
      await fs.writeFile(path.join(outDir, filename), bytes);
      record.status = 'generated';
      record.contentType = contentType;
      record.bytes = bytes.length;
      record.filename = filename;
      manifest.results.push(record);
      console.log('Generated ' + item.id + ' [' + language + '], ' + bytes.length + ' bytes');
    } catch (error) {
      record.status = 'failed';
      record.error = String(error?.message || error).slice(0, 1000);
      manifest.results.push(record);
      failed = true;
      break;
    }
  }
}

manifest.completedAt = new Date().toISOString();
manifest.generatedCount = manifest.results.filter(x => x.status === 'generated').length;
manifest.failed = failed;
await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({
  generatedCount: manifest.generatedCount,
  attemptedCount: manifest.results.length,
  failed: manifest.failed,
  manifest: path.join(outDir, 'manifest.json')
}, null, 2));

if (failed || manifest.generatedCount !== 20) process.exitCode = 1;
