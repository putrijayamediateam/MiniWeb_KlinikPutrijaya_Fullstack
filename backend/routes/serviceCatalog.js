'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

function normaliseText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function toPositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : null;
}

function parseBooleanFilter(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const normalised = normaliseText(value);

  if (
    normalised === '1' ||
    normalised === 'true' ||
    normalised === 'yes'
  ) {
    return 1;
  }

  if (
    normalised === '0' ||
    normalised === 'false' ||
    normalised === 'no'
  ) {
    return 0;
  }

  return null;
}

function createPlaceholders(count) {
  return Array.from(
    { length: count },
    () => '?'
  ).join(', ');
}

/*
  Attach available branches to each service.

  One query is used for the whole service list instead of
  running one branch query for every individual service.
*/
async function attachBranches(services) {
  if (!services.length) {
    return services;
  }

  const serviceIds = services.map(
    (service) => Number(service.id)
  );

  const placeholders =
    createPlaceholders(serviceIds.length);

  const [branchRows] = await db.query(
    `SELECT
       sb.service_id,
       b.id,
       b.name,
       b.slug,
       b.phone,
       b.whatsapp_link,
       b.address
     FROM service_branches sb
     INNER JOIN branches b
       ON b.id = sb.branch_id
     WHERE sb.service_id IN (${placeholders})
     ORDER BY b.id`,
    serviceIds
  );

  const branchesByService = new Map();

  branchRows.forEach((branch) => {
    const serviceId = Number(branch.service_id);

    if (!branchesByService.has(serviceId)) {
      branchesByService.set(serviceId, []);
    }

    branchesByService.get(serviceId).push({
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      phone: branch.phone,
      whatsapp_link: branch.whatsapp_link,
      address: branch.address,
    });
  });

  return services.map((service) => ({
    ...service,

    branches:
      branchesByService.get(Number(service.id)) || [],
  }));
}

/*
  GET /api/service-catalog

  Public Services V2 catalogue.

  Supported filters:

  ?search=influenza
  ?category=family-general-medicine
  ?category_id=1
  ?subcategory=infection-rapid-tests
  ?subcategory_id=4
  ?branch=puchong
  ?branch_id=3
  ?featured=true

  Prices are deliberately excluded from this public response.
*/
router.get('/', async (req, res) => {
  try {
    const search =
      normaliseText(req.query.search);

    const categorySlug =
      normaliseText(req.query.category);

    const categoryId =
      toPositiveInteger(req.query.category_id);

    const subcategorySlug =
      normaliseText(req.query.subcategory);

    const subcategoryId =
      toPositiveInteger(req.query.subcategory_id);

    const branchSlug =
      normaliseText(req.query.branch);

    const branchId =
      toPositiveInteger(req.query.branch_id);

    const featured =
      parseBooleanFilter(req.query.featured);

    const conditions = [
      's.is_active = 1',
      's.subcategory_id IS NOT NULL',
      'sc.is_active = 1',
      'c.is_active = 1',
    ];

    const params = [];

    if (categorySlug) {
      conditions.push('c.slug = ?');
      params.push(categorySlug);
    }

    if (categoryId) {
      conditions.push('c.id = ?');
      params.push(categoryId);
    }

    if (subcategorySlug) {
      conditions.push('sc.slug = ?');
      params.push(subcategorySlug);
    }

    if (subcategoryId) {
      conditions.push('sc.id = ?');
      params.push(subcategoryId);
    }

    if (branchSlug) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM service_branches sb_filter
          INNER JOIN branches b_filter
            ON b_filter.id = sb_filter.branch_id
          WHERE
            sb_filter.service_id = s.id
            AND b_filter.slug = ?
        )`
      );

      params.push(branchSlug);
    }

    if (branchId) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM service_branches sb_filter
          WHERE
            sb_filter.service_id = s.id
            AND sb_filter.branch_id = ?
        )`
      );

      params.push(branchId);
    }

    if (featured !== null) {
      conditions.push('s.is_featured = ?');
      params.push(featured);
    }

    if (search) {
      conditions.push(
        `LOWER(
          CONCAT_WS(
            ' ',
            s.title,
            s.kicker,
            s.description,
            s.full_description,
            s.suitable_for,
            s.included_items,
            s.preparation,
            s.aftercare,
            s.keywords,
            sc.name,
            c.name
          )
        ) LIKE ?`
      );

      params.push(`%${search}%`);
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
         s.keywords,
         s.result_time,
         s.sort_order,
         s.is_featured,
         s.is_active,

         sc.id AS subcategory_id,
         sc.name AS subcategory_name,
         sc.slug AS subcategory_slug,
         sc.short_description
           AS subcategory_description,

         c.id AS category_id,
         c.name AS category_name,
         c.slug AS category_slug,
         c.short_description
           AS category_description

       FROM services s

       INNER JOIN service_subcategories sc
         ON sc.id = s.subcategory_id

       INNER JOIN service_categories c
         ON c.id = sc.category_id

       WHERE ${conditions.join(' AND ')}

       ORDER BY
         c.sort_order,
         sc.sort_order,
         s.sort_order,
         s.title`,
      params
    );

    const servicesWithBranches =
      await attachBranches(rows);

    return res.json(servicesWithBranches);
  } catch (error) {
    console.error(
      'Public service catalogue error:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load the service catalogue.',
    });
  }
});

/*
  GET /api/service-catalog/slug/:slug

  Public Services V2 service detail.

  Includes:
  - category
  - subcategory
  - full service information
  - available branches
  - gallery

  Prices are not included.
*/
router.get('/slug/:slug', async (req, res) => {
  try {
    const slug =
      normaliseText(req.params.slug);

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
         s.keywords,
         s.result_time,
         s.sort_order,
         s.is_featured,
         s.is_active,
         s.created_at,
         s.updated_at,

         sc.id AS subcategory_id,
         sc.name AS subcategory_name,
         sc.slug AS subcategory_slug,
         sc.short_description
           AS subcategory_description,

         c.id AS category_id,
         c.name AS category_name,
         c.slug AS category_slug,
         c.short_description
           AS category_description

       FROM services s

       INNER JOIN service_subcategories sc
         ON sc.id = s.subcategory_id
         AND sc.is_active = 1

       INNER JOIN service_categories c
         ON c.id = sc.category_id
         AND c.is_active = 1

       WHERE
         s.slug = ?
         AND s.is_active = 1
         AND s.subcategory_id IS NOT NULL

       LIMIT 1`,
      [slug]
    );

    const service = rows[0];

    if (!service) {
      return res.status(404).json({
        message: 'Service not found.',
      });
    }

    const [
      servicesWithBranches,
      galleryResult,
    ] = await Promise.all([
      attachBranches([service]),

      db.query(
        `SELECT
           id,
           service_id,
           image_url,
           caption,
           alt_text,
           sort_order
         FROM service_gallery
         WHERE
           service_id = ?
           AND is_active = 1
         ORDER BY
           sort_order,
           id`,
        [service.id]
      ),
    ]);

    const gallery = galleryResult[0];

    return res.json({
      ...servicesWithBranches[0],

      category: {
        id: service.category_id,
        name: service.category_name,
        slug: service.category_slug,
        description:
          service.category_description,
      },

      subcategory: {
        id: service.subcategory_id,
        name: service.subcategory_name,
        slug: service.subcategory_slug,
        description:
          service.subcategory_description,
      },

      gallery,
    });
  } catch (error) {
    console.error(
      'Public service catalogue detail error:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load service details.',
    });
  }
});

module.exports = router;