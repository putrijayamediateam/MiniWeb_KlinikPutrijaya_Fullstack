'use strict';

const express = require('express');
const db = require('../db');

const {
  requireAdmin,
} = require('../middleware/auth');

const {
  requireActiveAdmin,
  requireManagementAccess,
} = require('../middleware/roles');

const router = express.Router();

const managementOnly = [
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
];

function cleanText(value) {
  return String(value || '').trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseActive(value, fallback = 1) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  return Number(value) === 1
    ? 1
    : 0;
}

function parseSortOrder(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.trunc(number)
    : 0;
}

async function getCategoryById(id) {
  const [rows] = await db.query(
    `SELECT
       id,
       name,
       slug,
       is_active
     FROM service_categories
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getSubcategoryById(id) {
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
       c.slug AS category_slug
     FROM service_subcategories sc
     INNER JOIN service_categories c
       ON c.id = sc.category_id
     WHERE sc.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getActiveServiceCount(
  subcategoryId
) {
  const [rows] = await db.query(
    `SELECT
       COUNT(*) AS active_services
     FROM services
     WHERE subcategory_id = ?
       AND is_active = 1`,
    [subcategoryId]
  );

  return Number(
    rows[0]?.active_services ||
    0
  );
}

/* =========================================================
   PUBLIC ROUTES
   ========================================================= */

/*
  GET /api/service-subcategories
*/
router.get('/', async (req, res) => {
  try {
    const categorySlug =
      cleanText(
        req.query.category
      ).toLowerCase();

    const categoryId =
      Number(
        req.query.category_id ||
        0
      );

    const conditions = [
      'sc.is_active = 1',
      'c.is_active = 1',
    ];

    const params = [];

    if (categorySlug) {
      conditions.push(
        'c.slug = ?'
      );

      params.push(
        categorySlug
      );
    }

    if (categoryId > 0) {
      conditions.push(
        'c.id = ?'
      );

      params.push(
        categoryId
      );
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

         COUNT(
           DISTINCT CASE
             WHEN s.is_active = 1
             THEN s.id
           END
         ) AS service_count

       FROM service_subcategories sc

       INNER JOIN service_categories c
         ON c.id = sc.category_id

       LEFT JOIN services s
         ON s.subcategory_id = sc.id

       WHERE ${conditions.join(
         ' AND '
       )}

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
      message:
        'Unable to load service subcategories.',
    });
  }
});

/*
  GET /api/service-subcategories/slug/:slug
*/
router.get(
  '/slug/:slug',
  async (req, res) => {
    try {
      const slug =
        cleanText(
          req.params.slug
        ).toLowerCase();

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
           c.short_description
             AS category_description,

           COUNT(
             DISTINCT CASE
               WHEN s.is_active = 1
               THEN s.id
             END
           ) AS service_count

         FROM service_subcategories sc

         INNER JOIN service_categories c
           ON c.id = sc.category_id
           AND c.is_active = 1

         LEFT JOIN services s
           ON s.subcategory_id = sc.id

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

      const subcategory =
        rows[0];

      if (!subcategory) {
        return res.status(404).json({
          message:
            'Service subcategory not found.',
        });
      }

      return res.json(
        subcategory
      );
    } catch (error) {
      console.error(
        'Service subcategory detail error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load service subcategory.',
      });
    }
  }
);

/* =========================================================
   ADMIN ROUTES — MANAGER / SUPERADMIN
   ========================================================= */

/*
  GET /api/service-subcategories/admin/all
*/
router.get(
  '/admin/all',
  ...managementOnly,
  async (req, res) => {
    try {
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
           c.is_active AS category_is_active,

           COUNT(
             DISTINCT s.id
           ) AS service_count,

           COUNT(
             DISTINCT CASE
               WHEN s.is_active = 1
               THEN s.id
             END
           ) AS active_service_count

         FROM service_subcategories sc

         INNER JOIN service_categories c
           ON c.id = sc.category_id

         LEFT JOIN services s
           ON s.subcategory_id = sc.id

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
           c.is_active,
           c.sort_order

         ORDER BY
           c.sort_order,
           c.name,
           sc.sort_order,
           sc.name`
      );

      return res.json(rows);
    } catch (error) {
      console.error(
        'Admin service subcategories error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load service subcategories.',
      });
    }
  }
);

/*
  POST /api/service-subcategories
*/
router.post(
  '/',
  ...managementOnly,
  async (req, res) => {
    try {
      const categoryId =
        Number(
          req.body.category_id
        );

      const name =
        cleanText(req.body.name);

      const slug =
        slugify(
          req.body.slug || name
        );

      const shortDescription =
        cleanText(
          req.body.short_description
        ) || null;

      const imageUrl =
        cleanText(
          req.body.image_url
        ) || null;

      const sortOrder =
        parseSortOrder(
          req.body.sort_order
        );

      const isActive =
        parseActive(
          req.body.is_active,
          1
        );

      if (
        !Number.isInteger(
          categoryId
        ) ||
        categoryId < 1
      ) {
        return res.status(400).json({
          message:
            'Please select a parent category.',
        });
      }

      if (!name) {
        return res.status(400).json({
          message:
            'Subcategory name is required.',
        });
      }

      if (!slug) {
        return res.status(400).json({
          message:
            'A valid subcategory slug is required.',
        });
      }

      const category =
        await getCategoryById(
          categoryId
        );

      if (!category) {
        return res.status(404).json({
          message:
            'Parent category not found.',
        });
      }

      if (
        isActive === 1 &&
        Number(category.is_active) !== 1
      ) {
        return res.status(409).json({
          message:
            'Activate the parent category before creating an active subcategory.',
        });
      }

      const [result] =
        await db.query(
          `INSERT INTO service_subcategories (
             category_id,
             name,
             slug,
             short_description,
             image_url,
             sort_order,
             is_active
           )
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            categoryId,
            name,
            slug,
            shortDescription,
            imageUrl,
            sortOrder,
            isActive,
          ]
        );

      return res.status(201).json(
        await getSubcategoryById(
          result.insertId
        )
      );
    } catch (error) {
      if (
        error.code ===
        'ER_DUP_ENTRY'
      ) {
        return res.status(409).json({
          message:
            'This subcategory name or slug is already in use.',
        });
      }

      console.error(
        'Create service subcategory error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to create service subcategory.',
      });
    }
  }
);

/*
  PUT /api/service-subcategories/:id
*/
router.put(
  '/:id',
  ...managementOnly,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id < 1
      ) {
        return res.status(400).json({
          message:
            'Invalid subcategory ID.',
        });
      }

      const existing =
        await getSubcategoryById(
          id
        );

      if (!existing) {
        return res.status(404).json({
          message:
            'Service subcategory not found.',
        });
      }

      const categoryId =
        Number(
          req.body.category_id
        );

      const name =
        cleanText(req.body.name);

      const slug =
        slugify(
          req.body.slug || name
        );

      const shortDescription =
        cleanText(
          req.body.short_description
        ) || null;

      const imageUrl =
        cleanText(
          req.body.image_url
        ) || null;

      const sortOrder =
        parseSortOrder(
          req.body.sort_order
        );

      const isActive =
        parseActive(
          req.body.is_active,
          Number(existing.is_active)
        );

      if (
        !Number.isInteger(
          categoryId
        ) ||
        categoryId < 1
      ) {
        return res.status(400).json({
          message:
            'Please select a parent category.',
        });
      }

      if (!name) {
        return res.status(400).json({
          message:
            'Subcategory name is required.',
        });
      }

      if (!slug) {
        return res.status(400).json({
          message:
            'A valid subcategory slug is required.',
        });
      }

      const category =
        await getCategoryById(
          categoryId
        );

      if (!category) {
        return res.status(404).json({
          message:
            'Parent category not found.',
        });
      }

      if (
        isActive === 1 &&
        Number(category.is_active) !== 1
      ) {
        return res.status(409).json({
          message:
            'Activate the parent category before activating this subcategory.',
        });
      }

      if (
        Number(existing.is_active) === 1 &&
        isActive === 0
      ) {
        const activeServices =
          await getActiveServiceCount(
            id
          );

        if (activeServices > 0) {
          return res.status(409).json({
            message:
              'Deactivate or move all active services before deactivating this subcategory.',

            active_services:
              activeServices,
          });
        }
      }

      await db.query(
        `UPDATE service_subcategories
         SET
           category_id = ?,
           name = ?,
           slug = ?,
           short_description = ?,
           image_url = ?,
           sort_order = ?,
           is_active = ?
         WHERE id = ?`,
        [
          categoryId,
          name,
          slug,
          shortDescription,
          imageUrl,
          sortOrder,
          isActive,
          id,
        ]
      );

      return res.json(
        await getSubcategoryById(id)
      );
    } catch (error) {
      if (
        error.code ===
        'ER_DUP_ENTRY'
      ) {
        return res.status(409).json({
          message:
            'This subcategory name or slug is already in use.',
        });
      }

      console.error(
        'Update service subcategory error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update service subcategory.',
      });
    }
  }
);

/*
  PUT /api/service-subcategories/:id/status
*/
router.put(
  '/:id/status',
  ...managementOnly,
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const isActive =
        parseActive(
          req.body.is_active,
          1
        );

      if (
        !Number.isInteger(id) ||
        id < 1
      ) {
        return res.status(400).json({
          message:
            'Invalid subcategory ID.',
        });
      }

      const subcategory =
        await getSubcategoryById(
          id
        );

      if (!subcategory) {
        return res.status(404).json({
          message:
            'Service subcategory not found.',
        });
      }

      const category =
        await getCategoryById(
          subcategory.category_id
        );

      if (
        isActive === 1 &&
        Number(category?.is_active) !== 1
      ) {
        return res.status(409).json({
          message:
            'Activate the parent category before activating this subcategory.',
        });
      }

      if (isActive === 0) {
        const activeServices =
          await getActiveServiceCount(
            id
          );

        if (activeServices > 0) {
          return res.status(409).json({
            message:
              'Deactivate or move all active services before deactivating this subcategory.',

            active_services:
              activeServices,
          });
        }
      }

      await db.query(
        `UPDATE service_subcategories
         SET is_active = ?
         WHERE id = ?`,
        [
          isActive,
          id,
        ]
      );

      return res.json(
        await getSubcategoryById(id)
      );
    } catch (error) {
      console.error(
        'Update service subcategory status error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update subcategory status.',
      });
    }
  }
);

module.exports = router;