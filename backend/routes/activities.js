'use strict';

const express = require('express');
const db = require('../db');
const {
  requireAdmin,
} = require('../middleware/auth');

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
  if (hasOwn(body, key)) {
    return nullableText(body[key]);
  }

  return nullableText(current[key]);
}

function toBooleanNumber(
  value,
  fallback = 0
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  return Number(value) === 1 ? 1 : 0;
}

function toSortOrder(
  value,
  fallback = 0
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return Number(fallback) || 0;
  }

  return Number(value) || 0;
}

function activityPayload(
  body,
  current = {}
) {
  const title = hasOwn(body, 'title')
    ? String(body.title ?? '').trim()
    : String(current.title ?? '').trim();

  const requestedSlug = hasOwn(
    body,
    'slug'
  )
    ? String(body.slug ?? '').trim()
    : String(current.slug ?? '').trim();

  const category = hasOwn(
    body,
    'category'
  )
    ? String(body.category ?? '').trim()
    : String(current.category ?? '').trim();

  return {
    slug: slugify(
      requestedSlug || title
    ),

    category,

    title,

    short_description:
      editableNullableText(
        body,
        current,
        'short_description'
      ),

    event_date: hasOwn(
      body,
      'event_date'
    )
      ? nullableText(body.event_date)
      : nullableText(
          current.event_date
        ),

    meta_text:
      editableNullableText(
        body,
        current,
        'meta_text'
      ),

    location:
      editableNullableText(
        body,
        current,
        'location'
      ),

    cta_label:
      editableNullableText(
        body,
        current,
        'cta_label'
      ),

    cta_link:
      editableNullableText(
        body,
        current,
        'cta_link'
      ),

    cover_image_url:
      editableNullableText(
        body,
        current,
        'cover_image_url'
      ),

    sort_order: toSortOrder(
      body.sort_order,
      current.sort_order
    ),

    is_featured: toBooleanNumber(
      body.is_featured,
      current.is_featured ===
        undefined
        ? 0
        : Number(
            current.is_featured
          )
    ),

    is_active: toBooleanNumber(
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

async function getGalleryByActivityIds(
  activityIds,
  includeInactive = false
) {
  if (!activityIds.length) {
    return new Map();
  }

  const placeholders = activityIds
    .map(() => '?')
    .join(', ');

  const [rows] = await db.query(
    `SELECT
       id,
       activity_id,
       image_url,
       caption,
       alt_text,
       sort_order,
       is_active,
       created_at,
       updated_at
     FROM community_activity_gallery
     WHERE
       activity_id IN (${placeholders})
       ${
         includeInactive
           ? ''
           : 'AND is_active = 1'
       }
     ORDER BY
       sort_order,
       id`,
    activityIds
  );

  const galleryMap = new Map();

  rows.forEach((row) => {
    const activityId = Number(
      row.activity_id
    );

    if (!galleryMap.has(activityId)) {
      galleryMap.set(activityId, []);
    }

    galleryMap
      .get(activityId)
      .push(row);
  });

  return galleryMap;
}

async function attachGallery(
  activities,
  includeInactive = false
) {
  if (!activities.length) {
    return activities;
  }

  const activityIds = activities.map(
    (activity) =>
      Number(activity.id)
  );

  const galleryMap =
    await getGalleryByActivityIds(
      activityIds,
      includeInactive
    );

  return activities.map((activity) => ({
    ...activity,

    gallery:
      galleryMap.get(
        Number(activity.id)
      ) || [],
  }));
}

/* =========================================================
   Public activities
   ========================================================= */

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         id,
         slug,
         category,
         title,
         short_description,
         event_date,
         meta_text,
         location,
         cta_label,
         cta_link,
         cover_image_url,
         sort_order,
         is_featured,
         is_active,
         created_at,
         updated_at
       FROM community_activities
       WHERE is_active = 1
       ORDER BY
         sort_order,
         event_date DESC,
         id DESC`
    );

    const activities =
      await attachGallery(rows);

    return res.json(activities);
  } catch (error) {
    console.error(
      'Public activities error:',
      error
    );

    return res.status(500).json({
      message:
        'Unable to load activities.',
    });
  }
});

router.get(
  '/slug/:slug',
  async (req, res) => {
    try {
      const slug = slugify(
        req.params.slug
      );

      const [rows] = await db.query(
        `SELECT
           id,
           slug,
           category,
           title,
           short_description,
           event_date,
           meta_text,
           location,
           cta_label,
           cta_link,
           cover_image_url,
           sort_order,
           is_featured,
           is_active,
           created_at,
           updated_at
         FROM community_activities
         WHERE
           slug = ?
           AND is_active = 1
         LIMIT 1`,
        [slug]
      );

      if (!rows.length) {
        return res.status(404).json({
          message:
            'Activity not found.',
        });
      }

      const activities =
        await attachGallery(rows);

      return res.json(
        activities[0]
      );
    } catch (error) {
      console.error(
        'Public activity detail error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load activity.',
      });
    }
  }
);

/* =========================================================
   Admin activities
   ========================================================= */

router.get(
  '/admin/all',
  requireAdmin,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT
           id,
           slug,
           category,
           title,
           short_description,
           event_date,
           meta_text,
           location,
           cta_label,
           cta_link,
           cover_image_url,
           sort_order,
           is_featured,
           is_active,
           created_at,
           updated_at
         FROM community_activities
         ORDER BY
           sort_order,
           event_date DESC,
           id DESC`
      );

      const activities =
        await attachGallery(
          rows,
          true
        );

      return res.json(activities);
    } catch (error) {
      console.error(
        'Admin activities error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load activities.',
      });
    }
  }
);

router.get(
  '/admin/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      const [rows] = await db.query(
        `SELECT
           id,
           slug,
           category,
           title,
           short_description,
           event_date,
           meta_text,
           location,
           cta_label,
           cta_link,
           cover_image_url,
           sort_order,
           is_featured,
           is_active,
           created_at,
           updated_at
         FROM community_activities
         WHERE id = ?
         LIMIT 1`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          message:
            'Activity not found.',
        });
      }

      const activities =
        await attachGallery(
          rows,
          true
        );

      return res.json(
        activities[0]
      );
    } catch (error) {
      console.error(
        'Admin activity detail error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load activity.',
      });
    }
  }
);

/* =========================================================
   Create activity
   ========================================================= */

router.post(
  '/',
  requireAdmin,
  async (req, res) => {
    try {
      const payload =
        activityPayload(req.body);

      if (
        !payload.title ||
        !payload.slug ||
        !payload.category
      ) {
        return res.status(400).json({
          message:
            'Category, title and slug are required.',
        });
      }

      const [duplicate] =
        await db.query(
          `SELECT id
           FROM community_activities
           WHERE slug = ?
           LIMIT 1`,
          [payload.slug]
        );

      if (duplicate.length) {
        return res.status(409).json({
          message:
            'That activity slug is already in use.',
        });
      }

      const [result] =
        await db.query(
          `INSERT INTO community_activities
           (
             slug,
             category,
             title,
             short_description,
             event_date,
             meta_text,
             location,
             cta_label,
             cta_link,
             cover_image_url,
             sort_order,
             is_featured,
             is_active
           )
           VALUES
           (
             ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?
           )`,
          [
            payload.slug,
            payload.category,
            payload.title,
            payload.short_description,
            payload.event_date,
            payload.meta_text,
            payload.location,
            payload.cta_label,
            payload.cta_link,
            payload.cover_image_url,
            payload.sort_order,
            payload.is_featured,
            payload.is_active,
          ]
        );

      return res.status(201).json({
        message:
          'Activity created successfully.',
        id: result.insertId,
        slug: payload.slug,
      });
    } catch (error) {
      console.error(
        'Create activity error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to create activity.',
      });
    }
  }
);

/* =========================================================
   Update activity
   ========================================================= */

router.put(
  '/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          message:
            'A valid activity ID is required.',
        });
      }

      const [existingRows] =
        await db.query(
          `SELECT *
           FROM community_activities
           WHERE id = ?
           LIMIT 1`,
          [id]
        );

      const existing =
        existingRows[0];

      if (!existing) {
        return res.status(404).json({
          message:
            'Activity not found.',
        });
      }

      const payload =
        activityPayload(
          req.body,
          existing
        );

      if (
        !payload.title ||
        !payload.slug ||
        !payload.category
      ) {
        return res.status(400).json({
          message:
            'Category, title and slug are required.',
        });
      }

      const [duplicate] =
        await db.query(
          `SELECT id
           FROM community_activities
           WHERE
             slug = ?
             AND id <> ?
           LIMIT 1`,
          [payload.slug, id]
        );

      if (duplicate.length) {
        return res.status(409).json({
          message:
            'That activity slug is already in use.',
        });
      }

      await db.query(
        `UPDATE community_activities SET
           slug = ?,
           category = ?,
           title = ?,
           short_description = ?,
           event_date = ?,
           meta_text = ?,
           location = ?,
           cta_label = ?,
           cta_link = ?,
           cover_image_url = ?,
           sort_order = ?,
           is_featured = ?,
           is_active = ?
         WHERE id = ?`,
        [
          payload.slug,
          payload.category,
          payload.title,
          payload.short_description,
          payload.event_date,
          payload.meta_text,
          payload.location,
          payload.cta_label,
          payload.cta_link,
          payload.cover_image_url,
          payload.sort_order,
          payload.is_featured,
          payload.is_active,
          id,
        ]
      );

      return res.json({
        message:
          'Activity updated successfully.',
        slug: payload.slug,
      });
    } catch (error) {
      console.error(
        'Update activity error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update activity.',
      });
    }
  }
);

/* =========================================================
   Delete activity
   ========================================================= */

router.delete(
  '/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      const [result] =
        await db.query(
          `DELETE FROM community_activities
           WHERE id = ?`,
          [id]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            'Activity not found.',
        });
      }

      return res.json({
        message:
          'Activity deleted successfully.',
      });
    } catch (error) {
      console.error(
        'Delete activity error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to delete activity.',
      });
    }
  }
);

/* =========================================================
   Activity gallery
   ========================================================= */

router.post(
  '/:activityId/gallery',
  requireAdmin,
  async (req, res) => {
    try {
      const activityId = Number(
        req.params.activityId
      );

      const imageUrl = String(
        req.body.image_url || ''
      ).trim();

      const caption = nullableText(
        req.body.caption
      );

      const altText = nullableText(
        req.body.alt_text
      );

      const sortOrder = toSortOrder(
        req.body.sort_order,
        0
      );

      const isActive =
        toBooleanNumber(
          req.body.is_active,
          1
        );

      if (
        !activityId ||
        !imageUrl
      ) {
        return res.status(400).json({
          message:
            'Activity ID and image are required.',
        });
      }

      const [activityRows] =
        await db.query(
          `SELECT id
           FROM community_activities
           WHERE id = ?
           LIMIT 1`,
          [activityId]
        );

      if (!activityRows.length) {
        return res.status(404).json({
          message:
            'Activity not found.',
        });
      }

      const [result] =
        await db.query(
          `INSERT INTO community_activity_gallery
           (
             activity_id,
             image_url,
             caption,
             alt_text,
             sort_order,
             is_active
           )
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            activityId,
            imageUrl,
            caption,
            altText,
            sortOrder,
            isActive,
          ]
        );

      return res.status(201).json({
        message:
          'Gallery image added successfully.',
        id: result.insertId,
      });
    } catch (error) {
      console.error(
        'Create activity gallery error:',
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
  async (req, res) => {
    try {
      const galleryId = Number(
        req.params.galleryId
      );

      const imageUrl = String(
        req.body.image_url || ''
      ).trim();

      const caption = nullableText(
        req.body.caption
      );

      const altText = nullableText(
        req.body.alt_text
      );

      const sortOrder = toSortOrder(
        req.body.sort_order,
        0
      );

      const isActive =
        toBooleanNumber(
          req.body.is_active,
          1
        );

      if (
        !galleryId ||
        !imageUrl
      ) {
        return res.status(400).json({
          message:
            'Gallery ID and image are required.',
        });
      }

      const [result] =
        await db.query(
          `UPDATE community_activity_gallery SET
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
          'Gallery image updated successfully.',
      });
    } catch (error) {
      console.error(
        'Update activity gallery error:',
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
  async (req, res) => {
    try {
      const galleryId = Number(
        req.params.galleryId
      );

      const [result] =
        await db.query(
          `DELETE FROM community_activity_gallery
           WHERE id = ?`,
          [galleryId]
        );

      if (!result.affectedRows) {
        return res.status(404).json({
          message:
            'Gallery image not found.',
        });
      }

      return res.json({
        message:
          'Gallery image deleted successfully.',
      });
    } catch (error) {
      console.error(
        'Delete activity gallery error:',
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
