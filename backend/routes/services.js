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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function editableNullableText(
  body,
  current,
  key
) {
  /*
    Jika frontend menghantar field tersebut,
    termasuk null atau string kosong,
    gunakan nilai baharu.

    Jika field langsung tidak dihantar,
    barulah kekalkan nilai database lama.
  */
  if (hasOwn(body, key)) {
    return nullableText(
      body[key]
    );
  }

  return nullableText(
    current[key]
  );
}

function toActive(value, fallback = 1) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  return Number(value) === 1 ? 1 : 0;
}

function parseNullablePositiveInteger(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return Number.NaN;
  }

  return number;
}

function parseBranchIds(value) {
  if (value === undefined) {
    return {
      provided: false,
      valid: true,
      ids: [],
    };
  }

  const rawValues = Array.isArray(value)
    ? value
    : String(value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  if (!rawValues.length) {
    return {
      provided: true,
      valid: true,
      ids: [],
    };
  }

  const ids = rawValues.map(Number);

  const valid = ids.every(
    (id) => Number.isInteger(id) && id > 0
  );

  return {
    provided: true,
    valid,
    ids: valid ? [...new Set(ids)] : [],
  };
}

function createPlaceholders(count) {
  return Array.from(
    { length: count },
    () => '?'
  ).join(', ');
}

function servicePayload(
  body,
  current = {}
) {
  const title = hasOwn(
    body,
    'title'
  )
    ? String(
        body.title ?? ''
      ).trim()
    : String(
        current.title ?? ''
      ).trim();

  const requestedSlug = hasOwn(
    body,
    'slug'
  )
    ? String(
        body.slug ?? ''
      ).trim()
    : String(
        current.slug ?? ''
      ).trim();

  const subcategorySource =
    hasOwn(
      body,
      'subcategory_id'
    )
      ? body.subcategory_id
      : current.subcategory_id;

  const categoryKey =
    hasOwn(
      body,
      'category_key'
    )
      ? String(
          body.category_key ?? ''
        )
          .trim()
          .toLowerCase()
      : String(
          current.category_key ??
          'general'
        )
          .trim()
          .toLowerCase();

  return {
    category_key:
      categoryKey,

    subcategory_id:
      parseNullablePositiveInteger(
        subcategorySource
      ),

    /*
      Slug masih wajib.
      Jika field slug kosong,
      ia dijana daripada title.
    */
    slug: slugify(
      requestedSlug ||
      title
    ),

    title,

    kicker:
      editableNullableText(
        body,
        current,
        'kicker'
      ),

    description:
      editableNullableText(
        body,
        current,
        'description'
      ),

    full_description:
      editableNullableText(
        body,
        current,
        'full_description'
      ),

    suitable_for:
      editableNullableText(
        body,
        current,
        'suitable_for'
      ),

    included_items:
      editableNullableText(
        body,
        current,
        'included_items'
      ),

    preparation:
      editableNullableText(
        body,
        current,
        'preparation'
      ),

    aftercare:
      editableNullableText(
        body,
        current,
        'aftercare'
      ),

    hero_image_url:
      editableNullableText(
        body,
        current,
        'hero_image_url'
      ),

    keywords:
      editableNullableText(
        body,
        current,
        'keywords'
      ),

    result_time:
      editableNullableText(
        body,
        current,
        'result_time'
      ),

    is_featured:
      toActive(
        body.is_featured,
        current.is_featured ===
          undefined
          ? 0
          : Number(
              current.is_featured
            )
      ),

    sort_order:
      Number(
        hasOwn(
          body,
          'sort_order'
        )
          ? body.sort_order
          : current.sort_order ?? 0
      ) || 0,

    is_active:
      toActive(
        body.is_active,
        current.is_active ===
          undefined
          ? 1
          : Number(
              current.is_active
            )
      ),
  };
}

async function validateSubcategory(
  connection,
  subcategoryId
) {
  if (subcategoryId === null) {
    return true;
  }

  const [rows] = await connection.query(
    `SELECT id
     FROM service_subcategories
     WHERE id = ?
     LIMIT 1`,
    [subcategoryId]
  );

  return Boolean(rows.length);
}

async function validateBranchIds(
  connection,
  branchIds
) {
  if (!branchIds.length) {
    return true;
  }

  const placeholders =
    createPlaceholders(branchIds.length);

  const [rows] = await connection.query(
    `SELECT id
     FROM branches
     WHERE id IN (${placeholders})`,
    branchIds
  );

  return rows.length === branchIds.length;
}

async function replaceServiceBranches(
  connection,
  serviceId,
  branchIds
) {
  await connection.query(
    `DELETE FROM service_branches
     WHERE service_id = ?`,
    [serviceId]
  );

  if (!branchIds.length) {
    return;
  }

  const valuesSql = branchIds
    .map(() => '(?, ?)')
    .join(', ');

  const params = branchIds.flatMap(
    (branchId) => [serviceId, branchId]
  );

  await connection.query(
    `INSERT INTO service_branches
     (
       service_id,
       branch_id
     )
     VALUES ${valuesSql}`,
    params
  );
}

async function getBranchesForServiceIds(
  serviceIds
) {
  if (!serviceIds.length) {
    return new Map();
  }

  const placeholders =
    createPlaceholders(serviceIds.length);

  const [rows] = await db.query(
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

  const branchMap = new Map();

  rows.forEach((row) => {
    const serviceId = Number(row.service_id);

    if (!branchMap.has(serviceId)) {
      branchMap.set(serviceId, []);
    }

    branchMap.get(serviceId).push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      phone: row.phone,
      whatsapp_link: row.whatsapp_link,
      address: row.address,
    });
  });

  return branchMap;
}

async function attachBranches(services) {
  if (!services.length) {
    return services;
  }

  const serviceIds = services.map(
    (service) => Number(service.id)
  );

  const branchMap =
    await getBranchesForServiceIds(serviceIds);

  return services.map((service) => {
    const branches =
      branchMap.get(Number(service.id)) || [];

    return {
      ...service,
      branches,
      branch_ids: branches.map(
        (branch) => branch.id
      ),
    };
  });
}

async function getServiceDetailByWhere(
  whereSql,
  params,
  includeInactive = false
) {
  const activeSql = includeInactive
    ? ''
    : 'AND s.is_active = 1';

  const [services] = await db.query(
    `SELECT
       s.id,
       s.category_key,
       s.subcategory_id,
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
       s.is_featured,
       s.sort_order,
       s.is_active,
       s.created_at,
       s.updated_at,

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

     LEFT JOIN service_subcategories sc
       ON sc.id = s.subcategory_id

     LEFT JOIN service_categories c
       ON c.id = sc.category_id

     WHERE ${whereSql} ${activeSql}
     LIMIT 1`,
    params
  );

  const service = services[0];

  if (!service) {
    return null;
  }

  const [
    pricesResult,
    galleryResult,
    branchesResult,
  ] = await Promise.all([
    db.query(
      `SELECT
         id,
         service_id,
         package_name,
         package_description,
         price,
         original_price,
         sort_order,
         is_active
       FROM service_prices
       WHERE
         service_id = ?
         ${
           includeInactive
             ? ''
             : 'AND is_active = 1'
         }
       ORDER BY sort_order, id`,
      [service.id]
    ),

    db.query(
      `SELECT
         id,
         service_id,
         image_url,
         caption,
         alt_text,
         sort_order,
         is_active
       FROM service_gallery
       WHERE
         service_id = ?
         ${
           includeInactive
             ? ''
             : 'AND is_active = 1'
         }
       ORDER BY sort_order, id`,
      [service.id]
    ),

    db.query(
      `SELECT
         b.id,
         b.name,
         b.slug,
         b.phone,
         b.whatsapp_link,
         b.address
       FROM service_branches sb
       INNER JOIN branches b
         ON b.id = sb.branch_id
       WHERE sb.service_id = ?
       ORDER BY b.id`,
      [service.id]
    ),
  ]);

  const prices = pricesResult[0];
  const gallery = galleryResult[0];
  const branches = branchesResult[0];

  return {
    ...service,

    branch_ids: branches.map(
      (branch) => branch.id
    ),

    branches,
    prices,
    gallery,

    category: service.category_id
      ? {
          id: service.category_id,
          name: service.category_name,
          slug: service.category_slug,
          description:
            service.category_description,
        }
      : null,

    subcategory: service.subcategory_id
      ? {
          id: service.subcategory_id,
          name: service.subcategory_name,
          slug: service.subcategory_slug,
          description:
            service.subcategory_description,
        }
      : null,
  };
}

/*
  Legacy public service cards.

  This route remains active temporarily so the existing
  public Services page continues working while Services V2
  is being developed.
*/
router.get('/', async (req, res) => {
  try {
    const category = String(
      req.query.category || ''
    )
      .trim()
      .toLowerCase();

    const conditions = [
      's.is_active = 1',
      's.subcategory_id IS NULL',
    ];

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

         MIN(
           CASE
             WHEN sp.is_active = 1
             THEN sp.price
           END
         ) AS starting_price

       FROM services s

       LEFT JOIN service_prices sp
         ON sp.service_id = s.id

       WHERE ${conditions.join(' AND ')}

       GROUP BY
         s.id,
         s.category_key,
         s.slug,
         s.kicker,
         s.title,
         s.description,
         s.hero_image_url,
         s.sort_order,
         s.is_active

       ORDER BY
         s.category_key,
         s.sort_order,
         s.title`,
      params
    );

    return res.json(rows);
  } catch (error) {
    console.error(
      'Public services error:',
      error
    );

    return res.status(500).json({
      message: 'Unable to load services.',
    });
  }
});

router.get('/slug/:slug', async (req, res) => {
  try {
    const service =
      await getServiceDetailByWhere(
        's.slug = ?',
        [req.params.slug],
        false
      );

    if (!service) {
      return res.status(404).json({
        message: 'Service not found.',
      });
    }

    return res.json(service);
  } catch (error) {
    console.error(
      'Service detail error:',
      error
    );

    return res.status(500).json({
      message:
        'Unable to load service details.',
    });
  }
});

/*
  Admin service list.
*/
router.get(
  '/admin/all',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT
           s.id,
           s.category_key,
           s.subcategory_id,
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
           s.is_featured,
           s.sort_order,
           s.is_active,

           sc.name AS subcategory_name,
           sc.slug AS subcategory_slug,

           c.id AS category_id,
           c.name AS category_name,
           c.slug AS category_slug,

           (
             SELECT COUNT(*)
             FROM service_prices sp
             WHERE sp.service_id = s.id
           ) AS price_count,

           (
             SELECT COUNT(*)
             FROM service_gallery sg
             WHERE sg.service_id = s.id
           ) AS gallery_count,

           (
             SELECT COUNT(*)
             FROM service_branches sb
             WHERE sb.service_id = s.id
           ) AS branch_count

         FROM services s

         LEFT JOIN service_subcategories sc
           ON sc.id = s.subcategory_id

         LEFT JOIN service_categories c
           ON c.id = sc.category_id

         ORDER BY
           COALESCE(c.sort_order, 9999),
           COALESCE(sc.sort_order, 9999),
           s.sort_order,
           s.title`
      );

      const services =
        await attachBranches(rows);

      return res.json(services);
    } catch (error) {
      console.error(
        'Admin services error:',
        error
      );

      return res.status(500).json({
        message: 'Unable to load services.',
      });
    }
  }
);

router.get(
  '/admin/:id',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const service =
        await getServiceDetailByWhere(
          's.id = ?',
          [Number(req.params.id)],
          true
        );

      if (!service) {
        return res.status(404).json({
          message: 'Service not found.',
        });
      }

      return res.json(service);
    } catch (error) {
      console.error(
        'Admin service detail error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load service details.',
      });
    }
  }
);

/*
  Create service and assign branches in one transaction.
*/
router.post(
  '/',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    let connection;

    try {
      const payload = servicePayload(req.body);

      const branchSelection =
        parseBranchIds(req.body.branch_ids);

      if (
        !payload.title ||
        !payload.slug ||
        !payload.category_key
      ) {
        return res.status(400).json({
          message:
            'Category, title and slug are required.',
        });
      }

      if (
        Number.isNaN(payload.subcategory_id)
      ) {
        return res.status(400).json({
          message:
            'A valid service subcategory is required.',
        });
      }

      if (!branchSelection.valid) {
        return res.status(400).json({
          message:
            'One or more selected branches are invalid.',
        });
      }

      connection = await db.getConnection();

      await connection.beginTransaction();

      const [duplicate] =
        await connection.query(
          `SELECT id
           FROM services
           WHERE slug = ?
           LIMIT 1`,
          [payload.slug]
        );

      if (duplicate.length) {
        await connection.rollback();

        return res.status(409).json({
          message:
            'That service slug is already in use.',
        });
      }

      const subcategoryExists =
        await validateSubcategory(
          connection,
          payload.subcategory_id
        );

      if (!subcategoryExists) {
        await connection.rollback();

        return res.status(400).json({
          message:
            'The selected subcategory does not exist.',
        });
      }

      const branchesExist =
        await validateBranchIds(
          connection,
          branchSelection.ids
        );

      if (!branchesExist) {
        await connection.rollback();

        return res.status(400).json({
          message:
            'One or more selected branches do not exist.',
        });
      }

      const [result] =
        await connection.query(
          `INSERT INTO services
           (
             category_key,
             subcategory_id,
             slug,
             kicker,
             title,
             description,
             full_description,
             suitable_for,
             included_items,
             preparation,
             aftercare,
             hero_image_url,
             keywords,
             result_time,
             is_featured,
             sort_order,
             is_active
           )
           VALUES
           (
             ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?, ?
           )`,
          [
            payload.category_key,
            payload.subcategory_id,
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
            payload.keywords,
            payload.result_time,
            payload.is_featured,
            payload.sort_order,
            payload.is_active,
          ]
        );

      if (branchSelection.ids.length) {
        await replaceServiceBranches(
          connection,
          result.insertId,
          branchSelection.ids
        );
      }

      await connection.commit();

      return res.status(201).json({
        message:
          'Service created successfully.',
        id: result.insertId,
        slug: payload.slug,
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            'Create service rollback error:',
            rollbackError
          );
        }
      }

      console.error(
        'Create service error:',
        error
      );

      return res.status(500).json({
        message: 'Unable to create service.',
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

/*
  Update service and branch assignments in one transaction.
*/
router.put(
  '/:id',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    let connection;

    try {
      const id = Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          message:
            'A valid service ID is required.',
        });
      }

      const branchSelection =
        parseBranchIds(req.body.branch_ids);

      if (!branchSelection.valid) {
        return res.status(400).json({
          message:
            'One or more selected branches are invalid.',
        });
      }

      connection = await db.getConnection();

      await connection.beginTransaction();

      const [existingRows] =
        await connection.query(
          `SELECT *
           FROM services
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        );

      const existing = existingRows[0];

      if (!existing) {
        await connection.rollback();

        return res.status(404).json({
          message: 'Service not found.',
        });
      }

      const payload =
        servicePayload(req.body, existing);

      if (
        !payload.title ||
        !payload.slug ||
        !payload.category_key
      ) {
        await connection.rollback();

        return res.status(400).json({
          message:
            'Category, title and slug are required.',
        });
      }

      if (
        Number.isNaN(payload.subcategory_id)
      ) {
        await connection.rollback();

        return res.status(400).json({
          message:
            'A valid service subcategory is required.',
        });
      }

      const [duplicate] =
        await connection.query(
          `SELECT id
           FROM services
           WHERE
             slug = ?
             AND id <> ?
           LIMIT 1`,
          [payload.slug, id]
        );

      if (duplicate.length) {
        await connection.rollback();

        return res.status(409).json({
          message:
            'That service slug is already in use.',
        });
      }

      const subcategoryExists =
        await validateSubcategory(
          connection,
          payload.subcategory_id
        );

      if (!subcategoryExists) {
        await connection.rollback();

        return res.status(400).json({
          message:
            'The selected subcategory does not exist.',
        });
      }

      if (branchSelection.provided) {
        const branchesExist =
          await validateBranchIds(
            connection,
            branchSelection.ids
          );

        if (!branchesExist) {
          await connection.rollback();

          return res.status(400).json({
            message:
              'One or more selected branches do not exist.',
          });
        }
      }

      await connection.query(
        `UPDATE services SET
           category_key = ?,
           subcategory_id = ?,
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
           keywords = ?,
           result_time = ?,
           is_featured = ?,
           sort_order = ?,
           is_active = ?
         WHERE id = ?`,
        [
          payload.category_key,
          payload.subcategory_id,
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
          payload.keywords,
          payload.result_time,
          payload.is_featured,
          payload.sort_order,
          payload.is_active,
          id,
        ]
      );

      if (branchSelection.provided) {
        await replaceServiceBranches(
          connection,
          id,
          branchSelection.ids
        );
      }

      await connection.commit();

      return res.json({
        message:
          'Service updated successfully.',
        slug: payload.slug,
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          console.error(
            'Update service rollback error:',
            rollbackError
          );
        }
      }

      console.error(
        'Update service error:',
        error
      );

      return res.status(500).json({
        message: 'Unable to update service.',
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.delete(
  '/:id',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const [result] = await db.query(
        `DELETE FROM services
         WHERE id = ?`,
        [id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: 'Service not found.',
        });
      }

      return res.json({
        message:
          'Service deleted successfully.',
      });
    } catch (error) {
      console.error(
        'Delete service error:',
        error
      );

      if (
        error.code ===
        'ER_ROW_IS_REFERENCED_2'
      ) {
        return res.status(409).json({
          message:
            'This service is linked to bookings. Set it as inactive instead of deleting.',
        });
      }

      return res.status(500).json({
        message: 'Unable to delete service.',
      });
    }
  }
);

// ============================================================
// PRICES
// ============================================================

router.post(
  '/:serviceId/prices',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const serviceId =
        Number(req.params.serviceId);

      const packageName = String(
        req.body.package_name || ''
      ).trim();

      const packageDescription =
        nullableText(
          req.body.package_description
        );

      const price = Number(req.body.price);

      const originalPrice =
        req.body.original_price === '' ||
        req.body.original_price == null
          ? null
          : Number(req.body.original_price);

      const sortOrder =
        Number(req.body.sort_order || 0) || 0;

      const isActive =
        toActive(req.body.is_active, 1);

      if (
        !serviceId ||
        !packageName ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          message:
            'Package name and a valid price are required.',
        });
      }

      const [result] = await db.query(
        `INSERT INTO service_prices
         (
           service_id,
           package_name,
           package_description,
           price,
           original_price,
           sort_order,
           is_active
         )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          serviceId,
          packageName,
          packageDescription,
          price,
          originalPrice,
          sortOrder,
          isActive,
        ]
      );

      return res.status(201).json({
        message:
          'Price added successfully.',
        id: result.insertId,
      });
    } catch (error) {
      console.error(
        'Create price error:',
        error
      );

      return res.status(500).json({
        message: 'Unable to add price.',
      });
    }
  }
);

router.put(
  '/prices/:priceId',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const priceId =
        Number(req.params.priceId);

      const packageName = String(
        req.body.package_name || ''
      ).trim();

      const packageDescription =
        nullableText(
          req.body.package_description
        );

      const price = Number(req.body.price);

      const originalPrice =
        req.body.original_price === '' ||
        req.body.original_price == null
          ? null
          : Number(req.body.original_price);

      const sortOrder =
        Number(req.body.sort_order || 0) || 0;

      const isActive =
        toActive(req.body.is_active, 1);

      if (
        !priceId ||
        !packageName ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          message:
            'Package name and a valid price are required.',
        });
      }

      const [result] = await db.query(
        `UPDATE service_prices SET
           package_name = ?,
           package_description = ?,
           price = ?,
           original_price = ?,
           sort_order = ?,
           is_active = ?
         WHERE id = ?`,
        [
          packageName,
          packageDescription,
          price,
          originalPrice,
          sortOrder,
          isActive,
          priceId,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            'Price item not found.',
        });
      }

      return res.json({
        message:
          'Price updated successfully.',
      });
    } catch (error) {
      console.error(
        'Update price error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update price.',
      });
    }
  }
);

router.delete(
  '/prices/:priceId',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const [result] = await db.query(
        `DELETE FROM service_prices
         WHERE id = ?`,
        [Number(req.params.priceId)]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            'Price item not found.',
        });
      }

      return res.json({
        message:
          'Price deleted successfully.',
      });
    } catch (error) {
      console.error(
        'Delete price error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to delete price.',
      });
    }
  }
);

// ============================================================
// GALLERY
// ============================================================

router.post(
  '/:serviceId/gallery',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const serviceId =
        Number(req.params.serviceId);

      const imageUrl = String(
        req.body.image_url || ''
      ).trim();

      const caption =
        nullableText(req.body.caption);

      const altText =
        nullableText(req.body.alt_text);

      const sortOrder =
        Number(req.body.sort_order || 0) || 0;

      const isActive =
        toActive(req.body.is_active, 1);

      if (!serviceId || !imageUrl) {
        return res.status(400).json({
          message:
            'A gallery image is required.',
        });
      }

      const [result] = await db.query(
        `INSERT INTO service_gallery
         (
           service_id,
           image_url,
           caption,
           alt_text,
           sort_order,
           is_active
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          serviceId,
          imageUrl,
          caption,
          altText,
          sortOrder,
          isActive,
        ]
      );

      return res.status(201).json({
        message: 'Gallery image added.',
        id: result.insertId,
      });
    } catch (error) {
      console.error(
        'Create gallery error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to add gallery image.',
      });
    }
  }
);

router.put(
  '/gallery/:galleryId',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const galleryId =
        Number(req.params.galleryId);

      const imageUrl = String(
        req.body.image_url || ''
      ).trim();

      const caption =
        nullableText(req.body.caption);

      const altText =
        nullableText(req.body.alt_text);

      const sortOrder =
        Number(req.body.sort_order || 0) || 0;

      const isActive =
        toActive(req.body.is_active, 1);

      if (!galleryId || !imageUrl) {
        return res.status(400).json({
          message:
            'A gallery image is required.',
        });
      }

      const [result] = await db.query(
        `UPDATE service_gallery SET
           image_url = ?,
           caption = ?,
           alt_text = ?,
           sort_order = ?,
           is_active = ?
         WHERE id = ?`,
        [
          imageUrl,
          caption,
          altText,
          sortOrder,
          isActive,
          galleryId,
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            'Gallery image not found.',
        });
      }

      return res.json({
        message:
          'Gallery image updated.',
      });
    } catch (error) {
      console.error(
        'Update gallery error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update gallery image.',
      });
    }
  }
);

router.delete(
  '/gallery/:galleryId',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
    try {
      const [result] = await db.query(
        `DELETE FROM service_gallery
         WHERE id = ?`,
        [Number(req.params.galleryId)]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            'Gallery image not found.',
        });
      }

      return res.json({
        message:
          'Gallery image deleted.',
      });
    } catch (error) {
      console.error(
        'Delete gallery error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to delete gallery image.',
      });
    }
  }
);

module.exports = router;
