/**
 * Letakkan file ini di dalam folder: api/share.js
 *
 * File ini membedakan Preview Website Utama (/) dengan Preview Postingan (/p/:postId).
 * Saat bot WhatsApp / Telegram / X membuka /p/art-xxxx, server mengirimkan HTML dengan
 * og:title, og:description, dan og:image milik postingan tersebut.
 * Saat pengunjung manusia membuka linknya, browser langsung diarahkan ke halaman utama
 * dan otomatis membuka pop-up postingan tersebut.
 */

const FIREBASE_PROJECT_ID = 'sanvalas-story';

function escapeHtml(str) {
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

export default async function handler(req, res) {
  const { post } = req.query;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'sanvalas-story.vercel.app';
  const origin = `${protocol}://${host}`;
  const defaultPreviewImg = `${origin}/preview-logo.png`;

  if (!post) {
    return res.redirect(302, origin);
  }

  const targetWebUrl = `${origin}/?post=${encodeURIComponent(post)}`;
  const shareCanonicalUrl = `${origin}/p/${encodeURIComponent(post)}`;

  let ogTitle = 'SANVALAS STORY - Tim Kreatif OSIS MTsN 14';
  let ogDescription = 'Dokumentasi kegiatan, prestasi siswa, dan karya kreatif MTsN 14 Jakarta Timur.';
  let ogImage = defaultPreviewImg;

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sanvalas_articles/${encodeURIComponent(post)}`;
    const fsRes = await fetch(firestoreUrl);

    if (fsRes.ok) {
      const data = await fsRes.json();
      const fields = data.fields || {};

      const rawTitle = fields.title?.stringValue || '';
      const rawCategory = fields.category?.stringValue || '';
      const rawBody = fields.body?.stringValue || '';
      const rawImage = fields.image?.stringValue || '';

      if (rawTitle) {
        ogTitle = rawCategory
          ? `${rawTitle} (${rawCategory}) • SANVALAS STORY`
          : `${rawTitle} • SANVALAS STORY MTsN 14`;
      }

      if (rawBody) {
        const cleanBody = rawBody.replace(/\s+/g, ' ').trim();
        ogDescription = cleanBody.length > 155 ? `${cleanBody.slice(0, 155)}...` : cleanBody;
      }

      if (rawImage.startsWith('data:image/')) {
        ogImage = `${origin}/api/og-image?post=${encodeURIComponent(post)}`;
      } else if (getYouTubeThumb(rawImage)) {
        ogImage = getYouTubeThumb(rawImage);
      } else if (rawImage.startsWith('http://') || rawImage.startsWith('https://')) {
        if (/instagram\.com|tiktok\.com|drive\.google\.com/i.test(rawImage)) {
          ogImage = `${origin}/api/og-image?post=${encodeURIComponent(post)}`;
        } else {
          ogImage = rawImage;
        }
      }
    }
  } catch (err) {
    // Fallback tetap menggunakan default meta jika gagal fetch
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDescription);
  const safeImg = escapeHtml(ogImage);
  const safeShareUrl = escapeHtml(shareCanonicalUrl);
  const safeRedirectUrl = escapeHtml(targetWebUrl);

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="SANVALAS STORY MTsN 14">
  <meta property="og:url" content="${safeShareUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImg}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImg}">
  <meta http-equiv="refresh" content="0;url=${safeRedirectUrl}">
</head>
<body style="font-family:sans-serif;background:#0f3529;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Membuka postingan <strong>${safeTitle}</strong>...</p>
  <script>window.location.replace(${JSON.stringify(targetWebUrl)});</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}
