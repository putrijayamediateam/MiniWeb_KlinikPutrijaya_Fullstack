'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

const SERVICE_PAGE_BASE_URL =
  'https://klinikputrijaya.com/service-detail?slug=';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildServiceSitemap(slugs) {
  const urlEntries = slugs.map((slug) => {
    const canonicalUrl =
      `${SERVICE_PAGE_BASE_URL}${encodeURIComponent(
        slug
      )}`;

    return [
      '  <url>',
      `    <loc>${escapeXml(canonicalUrl)}</loc>`,
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries,
    '</urlset>',
    '',
  ].join('\n');
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT
         TRIM(s.slug) AS slug
       FROM services s
       INNER JOIN service_subcategories sc
         ON sc.id = s.subcategory_id
       INNER JOIN service_categories c
         ON c.id = sc.category_id
       WHERE
         s.is_active = 1
         AND s.subcategory_id IS NOT NULL
         AND s.slug IS NOT NULL
         AND TRIM(s.slug) <> ''
         AND sc.is_active = 1
         AND c.is_active = 1
       ORDER BY slug`
    );

    const uniqueSlugs = [
      ...new Set(
        (Array.isArray(rows) ? rows : [])
          .map((row) =>
            String(row.slug || '').trim()
          )
          .filter(Boolean)
      ),
    ];

    const xml = buildServiceSitemap(
      uniqueSlugs
    );

    return res
      .status(200)
      .set({
        'Cache-Control':
          'public, max-age=300',
        'Content-Type':
          'application/xml; charset=utf-8',
      })
      .send(xml);
  } catch (error) {
    console.error(
      'Service sitemap generation failed:',
      error
    );

    return res
      .status(503)
      .set('Cache-Control', 'no-store')
      .type('text/plain')
      .send(
        'Service sitemap temporarily unavailable.'
      );
  }
});

module.exports = router;
