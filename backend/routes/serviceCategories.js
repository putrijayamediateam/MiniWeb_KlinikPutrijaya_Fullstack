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
       short_description,
       image_url,
       sort_order,
       is_active
     FROM service_categories
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getCategoryDependencies(id) {
  const [rows] = await db.query(
    `SELECT
       COUNT(
         DISTINCT CASE
           WHEN sc.is_active = 1
           THEN sc.id
         END
       ) AS active_subcategories,

       COUNT(
         DISTINCT CASE
           WHEN s.is_active = 1
           THEN s.id
         END
       ) AS active_services
     FROM service_categories c
     LEFT JOIN service_subcategories sc
       ON sc.category_id = c.id
     LEFT JOIN services s
       ON s.subcategory_id = sc.id
     WHERE c.id = ?`,
    [id]
  );

  return {
    active_subcategories:
      Number(
        rows[0]?.active_subcategories ||
        0
      ),

    active_services:
      Number(
        rows[0]?.active_services ||
        0
      ),
  };
}

/* =========================================================
   PUBLIC ROUTES
   ========================================================= */

/*
  GET /api/service-categories

  Public active categories only.
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

         COUNT(
           DISTINCT CASE
             WHEN sc.is_active = 1
             THEN sc.id
           END
         ) AS subcategory_count,

         COUNT(
           DISTINCT CASE
             WHEN s.is_active = 1
             THEN s.id
           END
         ) AS service_count

       FROM service_categories c

       LEFT JOIN service_subcategories sc
         ON sc.category_id = c.id

       LEFT JOIN services s
         ON s.subcategory_id = sc.id

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
      message:
        'Unable to load service categories.',
    });
  }
});

/*
  GET /api/service-categories/slug/:slug
*/
router.get(
  '/slug/:slug',
  async (req, res) => {
    try {
      const slug = cleanText(
        req.params.slug
      ).toLowerCase();

      const [categoryRows] =
        await db.query(
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

      const category =
        categoryRows[0];

      if (!category) {
        return res.status(404).json({
          message:
            'Service category not found.',
        });
      }

      const [subcategories] =
        await db.query(
          `SELECT
             sc.id,
             sc.category_id,
             sc.name,
             sc.slug,
             sc.short_description,
             sc.image_url,
             sc.sort_order,
             sc.is_active,

             COUNT(
               DISTINCT CASE
                 WHEN s.is_active = 1
                 THEN s.id
               END
             ) AS service_count

           FROM service_subcategories sc

           LEFT JOIN services s
             ON s.subcategory_id = sc.id

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
        message:
          'Unable to load service category.',
      });
    }
  }
);

/* =========================================================
   ADMIN ROUTES — MANAGER / SUPERADMIN
   ========================================================= */

/*
  GET /api/service-categories/admin/all

  Return active and inactive categories.
*/
router.get(
  '/admin/all',
  ...managementOnly,
  async (req, res) => {
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

           COUNT(
             DISTINCT sc.id
           ) AS subcategory_count,

           COUNT(
             DISTINCT CASE
               WHEN sc.is_active = 1
               THEN sc.id
             END
           ) AS active_subcategory_count,

           COUNT(
             DISTINCT s.id
           ) AS service_count,

           COUNT(
             DISTINCT CASE
               WHEN s.is_active = 1
               THEN s.id
             END
           ) AS active_service_count

         FROM service_categories c

         LEFT JOIN service_subcategories sc
           ON sc.category_id = c.id

         LEFT JOIN services s
           ON s.subcategory_id = sc.id

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
        'Admin service categories error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load service categories.',
      });
    }
  }
);

/*
  POST /api/service-categories
*/
router.post(
  '/',
  ...managementOnly,
  async (req, res) => {
    try {
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

      if (!name) {
        return res.status(400).json({
          message:
            'Category name is required.',
        });
      }

      if (!slug) {
        return res.status(400).json({
          message:
            'A valid category slug is required.',
        });
      }

      const [result] = await db.query(
        `INSERT INTO service_categories (
           name,
           slug,
           short_description,
           image_url,
           sort_order,
           is_active
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name,
          slug,
          shortDescription,
          imageUrl,
          sortOrder,
          isActive,
        ]
      );

      const category =
        await getCategoryById(
          result.insertId
        );

      return res.status(201).json(
        category
      );
    } catch (error) {
      if (
        error.code ===
        'ER_DUP_ENTRY'
      ) {
        return res.status(409).json({
          message:
            'This category name or slug is already in use.',
        });
      }

      console.error(
        'Create service category error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to create service category.',
      });
    }
  }
);

/*
  PUT /api/service-categories/:id
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
            'Invalid category ID.',
        });
      }

      const existing =
        await getCategoryById(id);

      if (!existing) {
        return res.status(404).json({
          message:
            'Service category not found.',
        });
      }

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

      if (!name) {
        return res.status(400).json({
          message:
            'Category name is required.',
        });
      }

      if (!slug) {
        return res.status(400).json({
          message:
            'A valid category slug is required.',
        });
      }

      if (
        Number(existing.is_active) === 1 &&
        isActive === 0
      ) {
        const dependencies =
          await getCategoryDependencies(
            id
          );

        if (
          dependencies
            .active_subcategories >
            0 ||
          dependencies
            .active_services >
            0
        ) {
          return res.status(409).json({
            message:
              'Deactivate or move all active subcategories and services before deactivating this category.',

            dependencies,
          });
        }
      }

      await db.query(
        `UPDATE service_categories
         SET
           name = ?,
           slug = ?,
           short_description = ?,
           image_url = ?,
           sort_order = ?,
           is_active = ?
         WHERE id = ?`,
        [
          name,
          slug,
          shortDescription,
          imageUrl,
          sortOrder,
          isActive,
          id,
        ]
      );

      const category =
        await getCategoryById(id);

      return res.json(category);
    } catch (error) {
      if (
        error.code ===
        'ER_DUP_ENTRY'
      ) {
        return res.status(409).json({
          message:
            'This category name or slug is already in use.',
        });
      }

      console.error(
        'Update service category error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update service category.',
      });
    }
  }
);

/*
  PUT /api/service-categories/:id/status
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
            'Invalid category ID.',
        });
      }

      const category =
        await getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          message:
            'Service category not found.',
        });
      }

      if (isActive === 0) {
        const dependencies =
          await getCategoryDependencies(
            id
          );

        if (
          dependencies
            .active_subcategories >
            0 ||
          dependencies
            .active_services >
            0
        ) {
          return res.status(409).json({
            message:
              'Deactivate or move all active subcategories and services before deactivating this category.',

            dependencies,
          });
        }
      }

      await db.query(
        `UPDATE service_categories
         SET is_active = ?
         WHERE id = ?`,
        [
          isActive,
          id,
        ]
      );

      return res.json(
        await getCategoryById(id)
      );
    } catch (error) {
      console.error(
        'Update service category status error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update category status.',
      });
    }
  }
);

module.exports = router;