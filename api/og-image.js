/**
 * Letakkan file ini di dalam folder: api/og-image.js
 *
 * Kenapa file ini penting?
 * Di website SANVALAS STORY kamu, saat Tim Kreatif meng-upload foto dari HP/Laptop,
 * foto tersebut disimpan ke Firestore sebagai Base64 (data:image/jpeg;base64,...).
 * WhatsApp, Telegram, dan Facebook menolak gambar Base64 di tag og:image.
 * File ini mengubah Base64 tersebut menjadi file gambar biner asli (image/jpeg) secara instan!
 */

const FIREBASE_PROJECT_ID = 'sanvalas-story';

export default async function handler(req, res) {
  const { post } = req.query;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'sanvalas-story.vercel.app';
  const fallbackLogoUrl = `${protocol}://${host}/preview-logo.png`;

  if (!post) {
    return res.redirect(302, fallbackLogoUrl);
  }

  try {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/sanvalas_articles/${encodeURIComponent(post)}`;
    const fsRes = await fetch(firestoreUrl);

    if (!fsRes.ok) {
      return res.redirect(302, fallbackLogoUrl);
    }

    const data = await fsRes.json();
    const rawImage = data.fields?.image?.stringValue || '';

    // Jika foto berupa Base64 Data URL dari hasil upload langsung
    if (rawImage.startsWith('data:image/')) {
      const matches = rawImage.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (matches && matches[2]) {
        const mimeType = matches[1];
        const imageBuffer = Buffer.from(matches[2], 'base64');

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.status(200).send(imageBuffer);
      }
    }

    // Jika foto berupa URL eksternal langsung (Unsplash, Firebase Storage, dll)
    if (
      (rawImage.startsWith('http://') || rawImage.startsWith('https://')) &&
      !/instagram\.com|tiktok\.com|drive\.google\.com/i.test(rawImage)
    ) {
      return res.redirect(302, rawImage);
    }

    // Fallback ke logo default SANVALAS STORY jika postingan hanya berisi link IG/TikTok
    return res.redirect(302, fallbackLogoUrl);
  } catch (error) {
    return res.redirect(302, fallbackLogoUrl);
  }
}
