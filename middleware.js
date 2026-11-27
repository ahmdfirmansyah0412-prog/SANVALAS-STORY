/**
 * Letakkan file ini di folder paling luar (root) repository GitHub/Vercel kamu,
 * sejajar dengan file index.html.
 *
 * Cara kerja:
 * Saat seseorang membagikan link seperti https://sanvalas-story.vercel.app/?post=art-123456
 * Middleware ini mengambil data postingan tersebut langsung dari Firebase Firestore
 * dan mengganti tag <meta property="og:..."> di index.html sebelum dikirim ke WhatsApp/X/Telegram.
 */

export const config = {
  matcher: '/',
};

const FIREBASE_PROJECT_ID = 'sanvalas-story';

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getYouTubeThumb(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const postId = url.searchParams.get('post');

  // Jika link biasa tanpa ?post=..., biarkan tampil halaman utama normal
  if (!postId) {
    return;
  }

  try {
    // 1. Ambil dokumen postingan langsung dari Firestore REST API (tanpa perlu install SDK tambahan)
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sanvalas_articles/${encodeURIComponent(postId)}`;
    const fsRes = await fetch(firestoreUrl, { cache: 'no-store' });

    if (!fsRes.ok) {
      return; // Jika post tidak ditemukan, fallback ke meta default
    }

    const fsData = await fsRes.json();
    const fields = fsData.fields || {};

    const rawTitle = fields.title?.stringValue || 'SANVALAS STORY - Tim Kreatif OSIS MTsN 14';
    const rawCategory = fields.category?.stringValue || '';
    const rawBody = fields.body?.stringValue || '';
    const rawImage = fields.image?.stringValue || '';

    const ogTitle = rawCategory
      ? `${rawTitle} [${rawCategory}] - SANVALAS STORY`
      : `${rawTitle} - SANVALAS STORY MTsN 14`;

    const cleanDesc = rawBody
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 155);
    const ogDescription = cleanDesc
      ? `${cleanDesc}${rawBody.length > 155 ? '...' : ''}`
      : 'Dokumentasi kegiatan, prestasi siswa, dan karya kreatif MTsN 14 Jakarta Timur.';

    // 2. Tentukan URL gambar OG yang valid untuk WhatsApp/Sosmed
    // WhatsApp TIDAK mendukung data:image/... (Base64), jadi arahkan ke endpoint /api/og-image
    let ogImage = `${url.origin}/preview-logo.png`;
    if (rawImage.startsWith('data:image/')) {
      ogImage = `${url.origin}/api/og-image?post=${encodeURIComponent(postId)}`;
    } else if (getYouTubeThumb(rawImage)) {
      ogImage = getYouTubeThumb(rawImage);
    } else if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
      // Jika link berupa Instagram/TikTok, gunakan endpoint og-image agar fallback ke logo dengan rapi
      if (/instagram\.com|tiktok\.com|drive\.google\.com/i.test(rawImage)) {
        ogImage = `${url.origin}/api/og-image?post=${encodeURIComponent(postId)}`;
      } else {
        ogImage = rawImage;
      }
    }

    // 3. Ambil file index.html asli dari deployment Vercel
    const htmlRes = await fetch(new URL('/index.html', request.url));
    let html = await htmlRes.text();

    const safeTitle = escapeAttr(ogTitle);
    const safeDesc = escapeAttr(ogDescription);
    const safeImg = escapeAttr(ogImage);
    const safeUrl = escapeAttr(url.href);

    // 4. Suntikkan Meta Tags spesifik postingan ke dalam <head>
    html = html
      .replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`)
      .replace(/<meta name="description" content=".*?"\s*\/?>/i, `<meta name="description" content="${safeDesc}">`)
      .replace(/<meta property="og:type" content=".*?"\s*\/?>/i, `<meta property="og:type" content="article">`)
      .replace(/<meta property="og:url" content=".*?"\s*\/?>/i, `<meta property="og:url" content="${safeUrl}">`)
      .replace(/<meta property="og:title" content=".*?"\s*\/?>/i, `<meta property="og:title" content="${safeTitle}">`)
      .replace(/<meta property="og:description" content=".*?"\s*\/?>/i, `<meta property="og:description" content="${safeDesc}">`)
      .replace(/<meta property="og:image" content=".*?"\s*\/?>/i, `<meta property="og:image" content="${safeImg}">`)
      .replace(/<meta name="twitter:title" content=".*?"\s*\/?>/i, `<meta name="twitter:title" content="${safeTitle}">`)
      .replace(/<meta name="twitter:description" content=".*?"\s*\/?>/i, `<meta name="twitter:description" content="${safeDesc}">`)
      .replace(/<meta name="twitter:image" content=".*?"\s*\/?>/i, `<meta name="twitter:image" content="${safeImg}">`);

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    // Jika terjadi kendala jaringan, tetap tampilkan halaman normal tanpa error
    return;
  }
}
