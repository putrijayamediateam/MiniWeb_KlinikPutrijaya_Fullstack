'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

/*
  GET /api/service-subcategories

  Supported filters:

  ?category=family-general-medicine
  ?category_id=1
*/
router.get('/', async (req, res) => {
  try {
    const categorySlug = String(
      req.query.category || ''
    )
      .trim()
      .toLowerCase();

    const categoryId = Number(
      req.query.category_id || 0
    );

    const conditions = [
      'sc.is_active = 1',
      'c.is_active = 1',
    ];

    const params = [];

    if (categorySlug) {
      conditions.push('c.slug = ?');
      params.push(categorySlug);
    }

    if (categoryId > 0) {
      conditions.push('c.id = ?');
      params.push(categoryId);
    }

    const [rows] = await db.query(
      `SELECT
         sc.id,
         sc.category_id,
         sc.name,
         sc.slug,
         sc.short_description,
         sc.image_url,
         sc.sort_order,
         sc.is_active,
         c.name AS category_name,
         c.slug AS category_slug,
         COUNT(DISTINCT s.id) AS service_count
       FROM service_subcategories sc
       INNER JOIN service_categories c
         ON c.id = sc.category_id
       LEFT JOIN services s
         ON s.subcategory_id = sc.id
         AND s.is_active = 1
       WHERE ${conditions.join(' AND ')}
       GROUP BY
         sc.id,
         sc.category_id,
         sc.name,
         sc.slug,
         sc.short_description,
         sc.image_url,
         sc.sort_order,
         sc.is_active,
         c.name,
         c.slug,
         c.sort_order
       ORDER BY
         c.sort_order,
         sc.sort_order,
         sc.name`,
      params
    );

    return res.json(rows);
  } catch (error) {
    console.error(
      'Public service subcategories error:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load service subcategories.',
    });
  }
});

/*
  GET /api/service-subcategories/slug/:slug

  Return one active subcategory and its parent category.
*/
router.get('/slug/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();

    const [rows] = await db.query(
      `SELECT
         sc.id,
         sc.category_id,
         sc.name,
         sc.slug,
         sc.short_description,
         sc.image_url,
         sc.sort_order,
         sc.is_active,
         c.name AS category_name,
         c.slug AS category_slug,
         c.short_description AS category_description,
         COUNT(DISTINCT s.id) AS service_count
       FROM service_subcategories sc
       INNER JOIN service_categories c
         ON c.id = sc.category_id
         AND c.is_active = 1
       LEFT JOIN services s
         ON s.subcategory_id = sc.id
         AND s.is_active = 1
       WHERE sc.slug = ?
         AND sc.is_active = 1
       GROUP BY
         sc.id,
         sc.category_id,
         sc.name,
         sc.slug,
         sc.short_description,
         sc.image_url,
         sc.sort_order,
         sc.is_active,
         c.name,
         c.slug,
         c.short_description
       LIMIT 1`,
      [slug]
    );

    const subcategory = rows[0];

    if (!subcategory) {
      return res.status(404).json({
        message: 'Service subcategory not found.',
      });
    }

    return res.json(subcategory);
  } catch (error) {
    console.error(
      'Service subcategory detail error:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load service subcategory.',
    });
  }
});

module.exports = router;