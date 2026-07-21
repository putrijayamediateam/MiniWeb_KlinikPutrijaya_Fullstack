// ============================================================
// Klinik Putrijaya - Shared API Helper
// ============================================================

const API_BASE = (
  window.KP_API_BASE ||
  'http://localhost:4000/api'
).replace(/\/+$/, '');

async function apiRequest(path, options = {}) {
  const requestPath = path.startsWith('/')
    ? path
    : `/${path}`;

  const isFormData =
    options.body instanceof FormData;

  const requestOptions = {
    ...options,

    headers: {
      ...(
        !isFormData && options.body
          ? {
              'Content-Type':
                'application/json',
            }
          : {}
      ),

      ...(options.headers || {}),
    },
  };

  let response;

  try {
    response = await fetch(
      `${API_BASE}${requestPath}`,
      requestOptions
    );
  } catch (error) {
    console.error(
      'API connection error:',
      error
    );

    throw new Error(
      'Unable to connect to the server. Make sure the backend is running on port 4000.'
    );
  }

  let data = null;

  const contentType =
    response.headers.get('content-type') || '';

  if (
    contentType.includes(
      'application/json'
    )
  ) {
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed (${response.status}).`
    );
  }

  return data;
}

const KPApi = {
  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  getBranches: () =>
    apiRequest('/branches'),

  getDoctors(params = {}) {
    const query =
      new URLSearchParams(params).toString();

    return apiRequest(
      `/doctors${query ? `?${query}` : ''}`
    );
  },

  getServices: () =>
    apiRequest('/services'),

  getPromotions: () =>
    apiRequest('/promotions'),

  createBooking: (payload) =>
    apiRequest('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createFeedback: (payload) =>
    apiRequest('/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getApprovedFeedback: () =>
    apiRequest('/feedback'),

  login: (username, password) =>
    apiRequest('/auth/login', {
      method: 'POST',

      body: JSON.stringify({
        username,
        password,
      }),
    }),

  // ----------------------------------------------------------
  // Authenticated admin API
  // ----------------------------------------------------------

  withAuth(token) {
    if (!token) {
      throw new Error(
        'Authentication token is required.'
      );
    }

    const authHeaders = {
      Authorization: `Bearer ${token}`,
    };

    return {
      // ------------------------------------------------------
      // Bookings
      // ------------------------------------------------------

      getBookings: (status = '') =>
        apiRequest(
          `/bookings${
            status
              ? `?status=${encodeURIComponent(
                  status
                )}`
              : ''
          }`,
          {
            headers: authHeaders,
          }
        ),

      updateBookingStatus: (
        id,
        status
      ) =>
        apiRequest(
          `/bookings/${id}/status`,
          {
            method: 'PUT',
            headers: authHeaders,

            body: JSON.stringify({
              status,
            }),
          }
        ),

      deleteBooking: (id) =>
        apiRequest(`/bookings/${id}`, {
          method: 'DELETE',
          headers: authHeaders,
        }),

      // ------------------------------------------------------
      // Feedback
      // ------------------------------------------------------

      getAllFeedback: () =>
        apiRequest('/feedback/all', {
          headers: authHeaders,
        }),

      approveFeedback: (id) =>
        apiRequest(
          `/feedback/${id}/approve`,
          {
            method: 'PUT',
            headers: authHeaders,
          }
        ),

      deleteFeedback: (id) =>
        apiRequest(`/feedback/${id}`, {
          method: 'DELETE',
          headers: authHeaders,
        }),

      // ------------------------------------------------------
      // Doctors
      // ------------------------------------------------------

      getAdminDoctors: () =>
        apiRequest(
          '/doctors/admin/all',
          {
            headers: authHeaders,
          }
        ),

      createDoctor: (payload) =>
        apiRequest('/doctors', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        }),

      updateDoctor: (id, payload) =>
        apiRequest(`/doctors/${id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload),
        }),

      deleteDoctor: (id) =>
        apiRequest(`/doctors/${id}`, {
          method: 'DELETE',
          headers: authHeaders,
        }),

      // ------------------------------------------------------
      // Services
      // ------------------------------------------------------

      getAdminServices: () => apiRequest('/services/admin/all', {
  headers: authHeaders,
}),

      createService: (payload) =>
        apiRequest('/services', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        }),

      updateService: (id, payload) =>
        apiRequest(`/services/${id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload),
        }),

      deleteService: (id) =>
        apiRequest(`/services/${id}`, {
          method: 'DELETE',
          headers: authHeaders,
        }),

      // ------------------------------------------------------
      // Image upload
      // ------------------------------------------------------

      uploadImage: (file) => {
        if (!file) {
          return Promise.reject(
            new Error(
              'Please select an image.'
            )
          );
        }

        const formData =
          new FormData();

        // Must match upload.single('file')
        // inside backend/routes/uploads.js
        formData.append('file', file);

        return apiRequest('/uploads', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
        });
      },

      // ------------------------------------------------------
      // Promotions
      // ------------------------------------------------------

      getAdminPromotions: () =>
        apiRequest(
          '/promotions/admin/all',
          {
            headers: authHeaders,
          }
        ),

      createPromotion: (payload) =>
        apiRequest('/promotions', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        }),

      updatePromotion: (
        id,
        payload
      ) =>
        apiRequest(
          `/promotions/${id}`,
          {
            method: 'PUT',
            headers: authHeaders,
            body: JSON.stringify(payload),
          }
        ),

      deletePromotion: (id) =>
        apiRequest(
          `/promotions/${id}`,
          {
            method: 'DELETE',
            headers: authHeaders,
          }
        ),
    };
  },
};

window.KPApi = KPApi;