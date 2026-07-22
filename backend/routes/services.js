'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

function nullableText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function toActive(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  return Number(value) === 1 ? 1 : 0;
}

function servicePayload(body, current = {}) {
  const title = String(body.title ?? current.title ?? '').trim();
  const requestedSlug = String(body.slug ?? current.slug ?? '').trim();

  return {
    category_key: String(body.category_key ?? current.category_key ?? 'general').trim().toLowerCase(),
    slug: slugify(requestedSlug || title),
    kicker: nullableText(body.kicker ?? current.kicker),
    title,
    description: nullableText(body.description ?? current.description),
    full_description: nullableText(body.full_description ?? current.full_description),
    suitable_for: nullableText(body.suitable_for ?? current.suitable_for),
    included_items: nullableText(body.included_items ?? current.included_items),
    preparation: nullableText(body.preparation ?? current.preparation),
    aftercare: nullableText(body.aftercare ?? current.aftercare),
    hero_image_url: nullableText(body.hero_image_url ?? current.hero_image_url),
    sort_order: Number(body.sort_order ?? current.sort_order ?? 0) || 0,
    is_active: toActive(body.is_active, current.is_active === undefined ? 1 : Number(current.is_active)),
  };
}

async function getServiceDetailByWhere(whereSql, params, includeInactive = false) {
  const activeSql = includeInactive ? '' : 'AND s.is_active = 1';
  const [services] = await db.query(
    `SELECT
       s.id,
       s.category_key,
       s.slug,
       s.kicker,
       s.title,
       s.description,
       s.full_description,
       s.suitable_for,
       s.included_items,
       s.preparation,
       s.aftercare,
       s.hero_image_url,
       s.sort_order,
       s.is_active,
       s.created_at,
       s.updated_at
     FROM services s
     WHERE ${whereSql} ${activeSql}
     LIMIT 1`,
    params
  );

  const service = services[0];
  if (!service) return null;

  const [prices] = await db.query(
    `SELECT id, service_id, package_name, package_description, price, original_price, sort_order, is_active
     FROM service_prices
     WHERE service_id = ? ${includeInactive ? '' : 'AND is_active = 1'}
     ORDER BY sort_order, id`,
    [service.id]
  );

  const [gallery] = await db.query(
    `SELECT id, service_id, image_url, caption, alt_text, sort_order, is_active
     FROM service_gallery
     WHERE service_id = ? ${includeInactive ? '' : 'AND is_active = 1'}
     ORDER BY sort_order, id`,
    [service.id]
  );

  return { ...service, prices, gallery };
}

// Public service cards.
router.get('/', async (req, res) => {
  try {
    const category = String(req.query.category || '').trim().toLowerCase();
    const conditions = ['s.is_active = 1'];
    const params = [];

    if (category) {
      conditions.push('s.category_key = ?');
      params.push(category);
    }

    const [rows] = await db.query(
      `SELECT
         s.id,
         s.category_key,
         s.slug,
         s.kicker,
         s.title,
         s.description,
         s.hero_image_url,
         s.sort_order,
         s.is_active,
         MIN(CASE WHEN sp.is_active = 1 THEN sp.price END) AS starting_price
       FROM services s
       LEFT JOIN service_prices sp ON sp.service_id = s.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY
         s.id, s.category_key, s.slug, s.kicker, s.title,
         s.description, s.hero_image_url, s.sort_order, s.is_active
       ORDER BY s.category_key, s.sort_order, s.title`,
      params
    );

    return res.json(rows);
  } catch (error) {
    console.error('Public services error:', error);
    return res.status(500).json({ message: 'Unable to load services.' });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const service = await getServiceDetailByWhere('s.slug = ?', [req.params.slug], false);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    return res.json(service);
  } catch (error) {
    console.error('Service detail error:', error);
    return res.status(500).json({ message: 'Unable to load service details.' });
  }
});

router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         s.id,
         s.category_key,
         s.slug,
         s.kicker,
         s.title,
         s.description,
         s.full_description,
         s.suitable_for,
         s.included_items,
         s.preparation,
         s.aftercare,
         s.hero_image_url,
         s.sort_order,
         s.is_active,
         COUNT(DISTINCT sp.id) AS price_count,
         COUNT(DISTINCT sg.id) AS gallery_count
       FROM services s
       LEFT JOIN service_prices sp ON sp.service_id = s.id
       LEFT JOIN service_gallery sg ON sg.service_id = s.id
       GROUP BY
         s.id, s.category_key, s.slug, s.kicker, s.title, s.description,
         s.full_description, s.suitable_for, s.included_items, s.preparation,
         s.aftercare, s.hero_image_url, s.sort_order, s.is_active
       ORDER BY s.category_key, s.sort_order, s.title`
    );
    return res.json(rows);
  } catch (error) {
    console.error('Admin services error:', error);
    return res.status(500).json({ message: 'Unable to load services.' });
  }
});

router.get('/admin/:id', requireAdmin, async (req, res) => {
  try {
    const service = await getServiceDetailByWhere('s.id = ?', [Number(req.params.id)], true);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    return res.json(service);
  } catch (error) {
    console.error('Admin service detail error:', error);
    return res.status(500).json({ message: 'Unable to load service details.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const payload = servicePayload(req.body);

    if (!payload.title || !payload.slug || !payload.category_key) {
      return res.status(400).json({ message: 'Category, title and slug are required.' });
    }

    const [duplicate] = await db.query('SELECT id FROM services WHERE slug = ? LIMIT 1', [payload.slug]);
    if (duplicate.length) {
      return res.status(409).json({ message: 'That service slug is already in use.' });
    }

    const [result] = await db.query(
      `INSERT INTO services
       (category_key, slug, kicker, title, description, full_description,
        suitable_for, included_items, preparation, aftercare, hero_image_url,
        sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.category_key,
        payload.slug,
        payload.kicker,
        payload.title,
        payload.description,
        payload.full_description,
        payload.suitable_for,
        payload.included_items,
        payload.preparation,
        payload.aftercare,
        payload.hero_image_url,
        payload.sort_order,
        payload.is_active,
      ]
    );

    return res.status(201).json({
      message: 'Service created successfully.',
      id: result.insertId,
      slug: payload.slug,
    });
  } catch (error) {
    console.error('Create service error:', error);
    return res.status(500).json({ message: 'Unable to create service.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [existingRows] = await db.query('SELECT * FROM services WHERE id = ? LIMIT 1', [id]);
    const existing = existingRows[0];

    if (!existing) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const payload = servicePayload(req.body, existing);
    if (!payload.title || !payload.slug || !payload.category_key) {
      return res.status(400).json({ message: 'Category, title and slug are required.' });
    }

    const [duplicate] = await db.query(
      'SELECT id FROM services WHERE slug = ? AND id <> ? LIMIT 1',
      [payload.slug, id]
    );

    if (duplicate.length) {
      return res.status(409).json({ message: 'That service slug is already in use.' });
    }

    await db.query(
      `UPDATE services SET
         category_key = ?,
         slug = ?,
         kicker = ?,
         title = ?,
         description = ?,
         full_description = ?,
         suitable_for = ?,
         included_items = ?,
         preparation = ?,
         aftercare = ?,
         hero_image_url = ?,
         sort_order = ?,
         is_active = ?
       WHERE id = ?`,
      [
        payload.category_key,
        payload.slug,
        payload.kicker,
        payload.title,
        payload.description,
        payload.full_description,
        payload.suitable_for,
        payload.included_items,
        payload.preparation,
        payload.aftercare,
        payload.hero_image_url,
        payload.sort_order,
        payload.is_active,
        id,
      ]
    );

    return res.json({ message: 'Service updated successfully.', slug: payload.slug });
  } catch (error) {
    console.error('Update service error:', error);
    return res.status(500).json({ message: 'Unable to update service.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await db.query('DELETE FROM services WHERE id = ?', [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    return res.json({ message: 'Service deleted successfully.' });
  } catch (error) {
    console.error('Delete service error:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'This service is linked to bookings. Set it as inactive instead of deleting.',
      });
    }

    return res.status(500).json({ message: 'Unable to delete service.' });
  }
});

// Prices
router.post('/:serviceId/prices', requireAdmin, async (req, res) => {
  try {
    const serviceId = Number(req.params.serviceId);
    const packageName = String(req.body.package_name || '').trim();
    const packageDescription = nullableText(req.body.package_description);
    const price = Number(req.body.price);
    const originalPrice = req.body.original_price === '' || req.body.original_price == null
      ? null
      : Number(req.body.original_price);
    const sortOrder = Number(req.body.sort_order || 0) || 0;
    const isActive = toActive(req.body.is_active, 1);

    if (!serviceId || !packageName || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'Package name and a valid price are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO service_prices
       (service_id, package_name, package_description, price, original_price, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [serviceId, packageName, packageDescription, price, originalPrice, sortOrder, isActive]
    );

    return res.status(201).json({ message: 'Price added successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create price error:', error);
    return res.status(500).json({ message: 'Unable to add price.' });
  }
});

router.put('/prices/:priceId', requireAdmin, async (req, res) => {
  try {
    const priceId = Number(req.params.priceId);
    const packageName = String(req.body.package_name || '').trim();
    const packageDescription = nullableText(req.body.package_description);
    const price = Number(req.body.price);
    const originalPrice = req.body.original_price === '' || req.body.original_price == null
      ? null
      : Number(req.body.original_price);
    const sortOrder = Number(req.body.sort_order || 0) || 0;
    const isActive = toActive(req.body.is_active, 1);

    if (!priceId || !packageName || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'Package name and a valid price are required.' });
    }

    const [result] = await db.query(
      `UPDATE service_prices SET
         package_name = ?, package_description = ?, price = ?, original_price = ?,
         sort_order = ?, is_active = ?
       WHERE id = ?`,
      [packageName, packageDescription, price, originalPrice, sortOrder, isActive, priceId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Price item not found.' });
    }

    return res.json({ message: 'Price updated successfully.' });
  } catch (error) {
    console.error('Update price error:', error);
    return res.status(500).json({ message: 'Unable to update price.' });
  }
});

router.delete('/prices/:priceId', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM service_prices WHERE id = ?', [Number(req.params.priceId)]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Price item not found.' });
    }
    return res.json({ message: 'Price deleted successfully.' });
  } catch (error) {
    console.error('Delete price error:', error);
    return res.status(500).json({ message: 'Unable to delete price.' });
  }
});

// Gallery
router.post('/:serviceId/gallery', requireAdmin, async (req, res) => {
  try {
    const serviceId = Number(req.params.serviceId);
    const imageUrl = String(req.body.image_url || '').trim();
    const caption = nullableText(req.body.caption);
    const altText = nullableText(req.body.alt_text);
    const sortOrder = Number(req.body.sort_order || 0) || 0;
    const isActive = toActive(req.body.is_active, 1);

    if (!serviceId || !imageUrl) {
      return res.status(400).json({ message: 'A gallery image is required.' });
    }

    const [result] = await db.query(
      `INSERT INTO service_gallery
       (service_id, image_url, caption, alt_text, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [serviceId, imageUrl, caption, altText, sortOrder, isActive]
    );

    return res.status(201).json({ message: 'Gallery image added.', id: result.insertId });
  } catch (error) {
    console.error('Create gallery error:', error);
    return res.status(500).json({ message: 'Unable to add gallery image.' });
  }
});

router.put('/gallery/:galleryId', requireAdmin, async (req, res) => {
  try {
    const galleryId = Number(req.params.galleryId);
    const imageUrl = String(req.body.image_url || '').trim();
    const caption = nullableText(req.body.caption);
    const altText = nullableText(req.body.alt_text);
    const sortOrder = Number(req.body.sort_order || 0) || 0;
    const isActive = toActive(req.body.is_active, 1);

    if (!galleryId || !imageUrl) {
      return res.status(400).json({ message: 'A gallery image is required.' });
    }

    const [result] = await db.query(
      `UPDATE service_gallery SET
         image_url = ?, caption = ?, alt_text = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [imageUrl, caption, altText, sortOrder, isActive, galleryId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Gallery image not found.' });
    }

    return res.json({ message: 'Gallery image updated.' });
  } catch (error) {
    console.error('Update gallery error:', error);
    return res.status(500).json({ message: 'Unable to update gallery image.' });
  }
});

router.delete('/gallery/:galleryId', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM service_gallery WHERE id = ?', [Number(req.params.galleryId)]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Gallery image not found.' });
    }
    return res.json({ message: 'Gallery image deleted.' });
  } catch (error) {
    console.error('Delete gallery error:', error);
    return res.status(500).json({ message: 'Unable to delete gallery image.' });
  }
});

module.exports = router;
