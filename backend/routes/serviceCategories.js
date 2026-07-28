'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

/*
  GET /api/service-categories

  Return all active service categories together with:
  - number of active subcategories
  - number of active individual services
*/
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         c.id,
         c.name,
         c.slug,
         c.short_description,
         c.image_url,
         c.sort_order,
         c.is_active,
         COUNT(DISTINCT sc.id) AS subcategory_count,
         COUNT(DISTINCT s.id) AS service_count
       FROM service_categories c
       LEFT JOIN service_subcategories sc
         ON sc.category_id = c.id
         AND sc.is_active = 1
       LEFT JOIN services s
         ON s.subcategory_id = sc.id
         AND s.is_active = 1
       WHERE c.is_active = 1
       GROUP BY
         c.id,
         c.name,
         c.slug,
         c.short_description,
         c.image_url,
         c.sort_order,
         c.is_active
       ORDER BY
         c.sort_order,
         c.name`
    );

    return res.json(rows);
  } catch (error) {
    console.error(
      'Public service categories error:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load service categories.',
    });
  }
});

/*
  GET /api/service-categories/slug/:slug

  Return one category together with its active subcategories.
*/
router.get('/slug/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '')
      .trim()
      .toLowerCase();

    const [categoryRows] = await db.query(
      `SELECT
         id,
         name,
         slug,
         short_description,
         image_url,
         sort_order,
         is_active
       FROM service_categories
       WHERE slug = ?
         AND is_active = 1
       LIMIT 1`,
      [slug]
    );

    const category = categoryRows[0];

    if (!category) {
      return res.status(404).json({
        message: 'Service category not found.',
      });
    }

    const [subcategories] = await db.query(
      `SELECT
         sc.id,
         sc.category_id,
         sc.name,
         sc.slug,
         sc.short_description,
         sc.image_url,
         sc.sort_order,
         sc.is_active,
         COUNT(DISTINCT s.id) AS service_count
       FROM service_subcategories sc
       LEFT JOIN services s
         ON s.subcategory_id = sc.id
         AND s.is_active = 1
       WHERE sc.category_id = ?
         AND sc.is_active = 1
       GROUP BY
         sc.id,
         sc.category_id,
         sc.name,
         sc.slug,
         sc.short_description,
         sc.image_url,
         sc.sort_order,
         sc.is_active
       ORDER BY
         sc.sort_order,
         sc.name`,
      [category.id]
    );

    return res.json({
      ...category,
      subcategories,
    });
  } catch (error) {
    console.error(
      'Service category detail error:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load service category.',
    });
  }
});

module.exports = router;