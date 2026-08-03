'use strict';

document.addEventListener(
  'DOMContentLoaded',
  loadActivities
);

async function loadActivities() {
  const grid =
    document.getElementById(
      'activitiesGrid'
    );

  if (!grid) {
    return;
  }

  grid.innerHTML = `
    <div class="activities-loading">
      Loading activities…
    </div>
  `;

  try {
    const activities =
      await KPApi.getActivities();

    renderActivities(
      Array.isArray(activities)
        ? activities
        : []
    );
  } catch (error) {
    console.error(
      'Unable to load activities:',
      error
    );

    grid.innerHTML = `
      <div class="activities-empty activities-error">
        Unable to load activities at the moment.
        Please try again later.
      </div>
    `;
  }
}

function renderActivities(
  activities
) {
  const grid =
    document.getElementById(
      'activitiesGrid'
    );

  if (!grid) {
    return;
  }

  if (!activities.length) {
    grid.innerHTML = `
      <div class="activities-empty">
        No community activities are available yet.
      </div>
    `;

    return;
  }

  grid.innerHTML =
    activities
      .map(
        renderActivityCard
      )
      .join('');

  initialiseActivityGalleries();
}

function renderActivityCard(
  activity
) {
  const images =
    getActivityImages(
      activity
    );

  const metaText =
    getActivityMetaText(
      activity
    );

  const galleryMarkup =
    images.length
      ? images
          .map(
            (image, index) => `
              <img
                src="${escapeAttribute(
                  resolveImageUrl(
                    image.image_url
                  )
                )}"
                alt="${escapeAttribute(
                  image.alt_text ||
                  image.caption ||
                  `${activity.title} image ${
                    index + 1
                  }`
                )}"
                loading="lazy"
              >
            `
          )
          .join('')
      : `
          <div class="activity-image-placeholder">
            Klinik Putrijaya
          </div>
        `;

  const showGalleryButtons =
    images.length > 1;

  const ctaMarkup =
    activity.cta_link
      ? `
          <a
            href="${escapeAttribute(
              activity.cta_link
            )}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHtml(
              activity.cta_label ||
              'View activity →'
            )}
          </a>
        `
      : '';

  return `
    <article
      class="activity-card"
      data-activity-id="${Number(
        activity.id
      )}"
    >
      <div class="activity-gallery">
        <div class="gallery-track">
          ${galleryMarkup}
        </div>

        ${
          showGalleryButtons
            ? `
                <button
                  class="gallery-btn prev"
                  type="button"
                  aria-label="Previous image"
                >
                  ‹
                </button>

                <button
                  class="gallery-btn next"
                  type="button"
                  aria-label="Next image"
                >
                  ›
                </button>
              `
            : ''
        }
      </div>

      <div class="activity-content">
        <span class="activity-tag">
          ${escapeHtml(
            activity.category ||
            'Community'
          )}
        </span>

        <h4>
          ${escapeHtml(
            activity.title ||
            'Klinik Putrijaya Activity'
          )}
        </h4>

        ${
          metaText
            ? `
                <p class="activity-meta">
                  ${escapeHtml(
                    metaText
                  )}
                </p>
              `
            : ''
        }

        ${
          activity.short_description
            ? `
                <p>
                  ${escapeHtml(
                    activity.short_description
                  )}
                </p>
              `
            : ''
        }

        ${ctaMarkup}
      </div>
    </article>
  `;
}

function getActivityImages(
  activity
) {
  const images = [];

  /*
    Cover image always appears first.
  */
  if (
    activity.cover_image_url
  ) {
    images.push({
      image_url:
        activity.cover_image_url,

      caption:
        activity.title || '',

      alt_text:
        activity.title
          ? `${activity.title} cover image`
          : 'Activity cover image',

      is_cover: true,
    });
  }

  const gallery =
    Array.isArray(
      activity.gallery
    )
      ? activity.gallery.filter(
          (image) =>
            Number(
              image.is_active
            )
        )
      : [];

  gallery.forEach(
    (image) => {
      /*
        Avoid showing the exact same URL twice
        if the cover was also added to the gallery.
      */
      const alreadyIncluded =
        images.some(
          (existingImage) =>
            String(
              existingImage
                .image_url || ''
            ) ===
            String(
              image.image_url || ''
            )
        );

      if (!alreadyIncluded) {
        images.push(image);
      }
    }
  );

  return images;
}

function getActivityMetaText(
  activity
) {
  const manualMeta =
    String(
      activity.meta_text || ''
    ).trim();

  if (manualMeta) {
    return manualMeta;
  }

  const parts = [];

  if (activity.event_date) {
    parts.push(
      formatActivityDate(
        activity.event_date
      )
    );
  }

  if (activity.location) {
    parts.push(
      activity.location
    );
  }

  return parts.join(' · ');
}

function formatActivityDate(
  value
) {
  if (!value) {
    return '';
  }

  const date =
    new Date(
      `${String(value).slice(
        0,
        10
      )}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    'en-MY',
    {
      month: 'long',
      year: 'numeric',
    }
  ).format(date);
}

function initialiseActivityGalleries() {
  const reduceMotion =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

  document
    .querySelectorAll(
      '.activity-card'
    )
    .forEach((card) => {
      const track =
        card.querySelector(
          '.gallery-track'
        );

      const previous =
        card.querySelector(
          '.gallery-btn.prev'
        );

      const next =
        card.querySelector(
          '.gallery-btn.next'
        );

      if (
        !track ||
        !previous ||
        !next
      ) {
        return;
      }

      const count = () =>
        track.querySelectorAll(
          'img'
        ).length;

      const current = () =>
        Math.round(
          track.scrollLeft /
          track.clientWidth
        );

      function goTo(index) {
        track.scrollTo({
          left:
            track.clientWidth *
            index,

          behavior:
            reduceMotion
              ? 'auto'
              : 'smooth',
        });
      }

      next.addEventListener(
        'click',
        () => {
          const nextIndex =
            current() >=
            count() - 1
              ? 0
              : current() + 1;

          goTo(nextIndex);
        }
      );

      previous.addEventListener(
        'click',
        () => {
          const previousIndex =
            current() <= 0
              ? count() - 1
              : current() - 1;

          goTo(
            previousIndex
          );
        }
      );
    });
}

function resolveImageUrl(url) {
  if (!url) {
    return '';
  }

  if (
    /^https?:\/\//i.test(
      url
    )
  ) {
    return url;
  }

  const origin =
    new URL(
      KPApi.baseUrl
    ).origin;

  return (
    `${origin}` +
    `${url.startsWith('/') ? '' : '/'}` +
    `${url}`
  );
}

function escapeHtml(value) {
  const div =
    document.createElement(
      'div'
    );

  div.textContent =
    value == null
      ? ''
      : String(value);

  return div.innerHTML;
}

function escapeAttribute(value) {
  return String(
    value || ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    );
}