'use strict';

(function exposeKPApi() {
  const API_BASE = String(
    window.KP_API_BASE ||
      (
        ['localhost', '127.0.0.1'].includes(
          window.location.hostname
        )
          ? 'http://localhost:4000/api'
          : 'https://backend-production-d730.up.railway.app/api'
      )
  ).replace(/\/$/, '');

  /* =========================================================
     Helpers
     ========================================================= */

  function buildQuery(params = {}) {
    const search = new URLSearchParams();

    Object.entries(params).forEach(
      ([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== ''
        ) {
          search.set(
            key,
            String(value)
          );
        }
      }
    );

    const query = search.toString();

    return query
      ? `?${query}`
      : '';
  }

  async function apiRequest(
    path,
    options = {}
  ) {
    const isFormData =
      options.body instanceof FormData;

    const response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,

        headers: {
          ...(
            isFormData
              ? {}
              : {
                  'Content-Type':
                    'application/json',
                }
          ),

          ...(options.headers || {}),
        },
      }
    );

    const contentType =
      response.headers.get(
        'content-type'
      ) || '';

    const data =
      contentType.includes(
        'application/json'
      )
        ? await response.json()
        : await response.text();

    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data?.message
          ? data.message
          : `Request failed with status ${response.status}.`;

      const error =
        new Error(message);

      error.status =
        response.status;

      error.payload = data;

      throw error;
    }

    return data;
  }

  function jsonBody(payload) {
    return JSON.stringify(
      payload || {}
    );
  }

  function authHeaders(token) {
    return {
      Authorization:
        `Bearer ${token}`,
    };
  }

  /* =========================================================
     API
     ========================================================= */

  const KPApi = {
    baseUrl: API_BASE,

    /* ---------------------------------------------------------
       Authentication
       --------------------------------------------------------- */

    login(username, password) {
      return apiRequest(
        '/auth/login',
        {
          method: 'POST',

          body: jsonBody({
            username,
            password,
          }),
        }
      );
    },

    forgotPassword(email) {
      return apiRequest(
        '/auth/forgot-password',
        {
          method: 'POST',

          body: jsonBody({
            email,
          }),
        }
      );
    },

    resetPassword(
      token,
      newPassword
    ) {
      return apiRequest(
        '/auth/reset-password',
        {
          method: 'POST',

          body: jsonBody({
            token,
            newPassword,
          }),
        }
      );
    },

    /* ---------------------------------------------------------
       Branches
       --------------------------------------------------------- */

    getBranches() {
      return apiRequest(
        '/branches'
      );
    },

    /* ---------------------------------------------------------
       Service taxonomy
       --------------------------------------------------------- */

    getServiceCategories(
      params = {}
    ) {
      return apiRequest(
        `/service-categories${buildQuery(
          params
        )}`
      );
    },

    getServiceSubcategories(
      params = {}
    ) {
      return apiRequest(
        `/service-subcategories${buildQuery(
          params
        )}`
      );
    },

    /* ---------------------------------------------------------
       Doctors
       --------------------------------------------------------- */

    getDoctors(params = {}) {
      return apiRequest(
        `/doctors${buildQuery(
          params
        )}`
      );
    },

    /* ---------------------------------------------------------
       Legacy services
       --------------------------------------------------------- */

    getServices(params = {}) {
      return apiRequest(
        `/services${buildQuery(
          params
        )}`
      );
    },

    getServiceBySlug(slug) {
      return apiRequest(
        `/services/slug/${encodeURIComponent(
          slug
        )}`
      );
    },

    /* ---------------------------------------------------------
       Services V2 catalogue
       --------------------------------------------------------- */

    getServiceCatalog(
      params = {}
    ) {
      return apiRequest(
        `/service-catalog${buildQuery(
          params
        )}`
      );
    },

    getServiceCatalogBySlug(
      slug
    ) {
      return apiRequest(
        `/service-catalog/slug/${encodeURIComponent(
          slug
        )}`
      );
    },

    /* ---------------------------------------------------------
       Appointment booking
       --------------------------------------------------------- */

    createBooking(payload) {
      return apiRequest(
        '/bookings',
        {
          method: 'POST',
          body: jsonBody(payload),
        }
      );
    },

    /* ---------------------------------------------------------
       Website performance tracking
       --------------------------------------------------------- */

    trackPerformance(
      payload,
      options = {}
    ) {
      return apiRequest(
        '/performance/events',
        {
          method: 'POST',

          body: jsonBody(
            payload
          ),

          /*
            Helps the small analytics request continue
            when a visitor clicks an external link.
          */
          keepalive: Boolean(
            options.keepalive
          ),
        }
      );
    },

    /* ---------------------------------------------------------
       Public feedback
       --------------------------------------------------------- */

    getApprovedFeedback() {
      return apiRequest(
        '/feedback'
      );
    },

    createFeedback(payload) {
      return apiRequest(
        '/feedback',
        {
          method: 'POST',
          body: jsonBody(payload),
        }
      );
    },

    /* ---------------------------------------------------------
       Public promotions
       --------------------------------------------------------- */

    getPromotions() {
      return apiRequest(
        '/promotions'
      );
    },

    /* ---------------------------------------------------------
   Public activities
   --------------------------------------------------------- */

getActivities() {
  return apiRequest(
    '/activities'
  );
},

getActivityBySlug(slug) {
  return apiRequest(
    `/activities/slug/${encodeURIComponent(
      slug
    )}`
  );
},

    /* =========================================================
       Authenticated admin API
       ========================================================= */

    withAuth(token) {
      const headers =
        authHeaders(token);

      return {
        /* -----------------------------------------------------
           Admin account
           ----------------------------------------------------- */

        getMyAdminProfile() {
          return apiRequest(
            '/admin-users/me',
            {
              headers,
            }
          );
        },

        getPendingAdmins() {
          return apiRequest(
            '/admin-users/pending',
            {
              headers,
            }
          );
        },

        approveAdmin(id) {
          return apiRequest(
            `/admin-users/${id}/approve`,
            {
              method: 'PUT',
              headers,
            }
          );
        },

        rejectAdmin(
          id,
          reason = ''
        ) {
          return apiRequest(
            `/admin-users/${id}/reject`,
            {
              method: 'PUT',
              headers,

              body: jsonBody({
                reason,
              }),
            }
          );
        },

        /* -----------------------------------------------------
           Website performance dashboard
           ----------------------------------------------------- */

        getPerformanceOverview(
          params = {}
        ) {
          return apiRequest(
            `/performance/overview${buildQuery(
              params
            )}`,
            {
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Bookings
           ----------------------------------------------------- */

        getBookings(
          params = {}
        ) {
          return apiRequest(
            `/bookings${buildQuery(
              params
            )}`,
            {
              headers,
            }
          );
        },

        updateBookingStatus(
          id,
          status
        ) {
          return apiRequest(
            `/bookings/${id}/status`,
            {
              method: 'PUT',
              headers,

              body: jsonBody({
                status,
              }),
            }
          );
        },

        deleteBooking(id) {
          return apiRequest(
            `/bookings/${id}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Feedback
           ----------------------------------------------------- */

        getAllFeedback(
          params = {}
        ) {
          return apiRequest(
            `/feedback/admin/all${buildQuery(
              params
            )}`,
            {
              headers,
            }
          );
        },

        approveFeedback(id) {
          return apiRequest(
            `/feedback/${id}/approve`,
            {
              method: 'PUT',
              headers,
            }
          );
        },

        deleteFeedback(id) {
          return apiRequest(
            `/feedback/${id}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Doctors
           ----------------------------------------------------- */

        getAdminDoctors() {
          return apiRequest(
            '/doctors/admin/all',
            {
              headers,
            }
          );
        },

        createDoctor(payload) {
          return apiRequest(
            '/doctors',
            {
              method: 'POST',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        updateDoctor(
          id,
          payload
        ) {
          return apiRequest(
            `/doctors/${id}`,
            {
              method: 'PUT',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        deleteDoctor(id) {
          return apiRequest(
            `/doctors/${id}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Services
           ----------------------------------------------------- */

        getAdminServices() {
          return apiRequest(
            '/services/admin/all',
            {
              headers,
            }
          );
        },

        getAdminService(id) {
          return apiRequest(
            `/services/admin/${id}`,
            {
              headers,
            }
          );
        },

        createService(payload) {
          return apiRequest(
            '/services',
            {
              method: 'POST',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        updateService(
          id,
          payload
        ) {
          return apiRequest(
            `/services/${id}`,
            {
              method: 'PUT',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        deleteService(id) {
          return apiRequest(
            `/services/${id}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Service prices
           ----------------------------------------------------- */

        createServicePrice(
          serviceId,
          payload
        ) {
          return apiRequest(
            `/services/${serviceId}/prices`,
            {
              method: 'POST',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        updateServicePrice(
          priceId,
          payload
        ) {
          return apiRequest(
            `/services/prices/${priceId}`,
            {
              method: 'PUT',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        deleteServicePrice(
          priceId
        ) {
          return apiRequest(
            `/services/prices/${priceId}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Service gallery
           ----------------------------------------------------- */

        createGalleryItem(
          serviceId,
          payload
        ) {
          return apiRequest(
            `/services/${serviceId}/gallery`,
            {
              method: 'POST',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        updateGalleryItem(
          galleryId,
          payload
        ) {
          return apiRequest(
            `/services/gallery/${galleryId}`,
            {
              method: 'PUT',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        deleteGalleryItem(
          galleryId
        ) {
          return apiRequest(
            `/services/gallery/${galleryId}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Image upload
           ----------------------------------------------------- */

        uploadImage(
          file,
          folder = 'general'
        ) {
          const formData =
            new FormData();

          formData.append(
            'file',
            file
          );

          return apiRequest(
            `/uploads?folder=${encodeURIComponent(
              folder
            )}`,
            {
              method: 'POST',
              headers,
              body: formData,
            }
          );
        },

        /* -----------------------------------------------------
           Promotions
           ----------------------------------------------------- */

        getAdminPromotions() {
          return apiRequest(
            '/promotions/admin/all',
            {
              headers,
            }
          );
        },

        createPromotion(
          payload
        ) {
          return apiRequest(
            '/promotions',
            {
              method: 'POST',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        updatePromotion(
          id,
          payload
        ) {
          return apiRequest(
            `/promotions/${id}`,
            {
              method: 'PUT',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

                deletePromotion(id) {
          return apiRequest(
            `/promotions/${id}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Activities & CSR
           ----------------------------------------------------- */

        getAdminActivities() {
          return apiRequest(
            '/activities/admin/all',
            {
              headers,
            }
          );
        },

        getAdminActivity(id) {
          return apiRequest(
            `/activities/admin/${id}`,
            {
              headers,
            }
          );
        },

        createActivity(payload) {
          return apiRequest(
            '/activities',
            {
              method: 'POST',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        updateActivity(
          id,
          payload
        ) {
          return apiRequest(
            `/activities/${id}`,
            {
              method: 'PUT',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        deleteActivity(id) {
          return apiRequest(
            `/activities/${id}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },

        /* -----------------------------------------------------
           Activity gallery
           ----------------------------------------------------- */

        createActivityGalleryItem(
          activityId,
          payload
        ) {
          return apiRequest(
            `/activities/${activityId}/gallery`,
            {
              method: 'POST',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        updateActivityGalleryItem(
          galleryId,
          payload
        ) {
          return apiRequest(
            `/activities/gallery/${galleryId}`,
            {
              method: 'PUT',
              headers,

              body: jsonBody(
                payload
              ),
            }
          );
        },

        deleteActivityGalleryItem(
          galleryId
        ) {
          return apiRequest(
            `/activities/gallery/${galleryId}`,
            {
              method: 'DELETE',
              headers,
            }
          );
        },
      };
    },
  };

  window.KPApi = KPApi;
})();