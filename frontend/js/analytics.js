'use strict';

(function initialiseKPAnalytics() {
  if (window.KPAnalytics) {
    return;
  }

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

  const SESSION_KEY =
    'kp_performance_session';

  const VISIT_FLAG =
    'kp_performance_visit_recorded';

  const branchMatchers = [
    {
      id: 1,
      terms: [
        'cheras',
        'ohje1h',
        '0183144588',
        '018-314 4588',
        '1lhfv3y9ddtctldt5',
      ],
    },
    {
      id: 2,
      terms: [
        'sungai besi',
        'edexo9',
        '0193470448',
        '019-347 0448',
        '6st8vbcxo6uq3c8t9',
      ],
    },
    {
      id: 3,
      terms: [
        'puchong',
        's5e9zp',
        '0193870448',
        '019-387 0448',
        '3pjf38cq6noh9snv6',
      ],
    },
  ];

  function createSessionId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return [
      Date.now().toString(36),
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2),
    ].join('-');
  }

  function getSessionId() {
    let sessionId =
      sessionStorage.getItem(
        SESSION_KEY
      );

    if (!sessionId) {
      sessionId =
        createSessionId();

      sessionStorage.setItem(
        SESSION_KEY,
        sessionId
      );
    }

    return sessionId;
  }

  function positiveNumber(value) {
    const number = Number(value);

    return (
      Number.isInteger(number) &&
      number > 0
    )
      ? number
      : null;
  }

  function getQueryValue(name) {
    return new URLSearchParams(
      window.location.search
    ).get(name);
  }

  function currentPagePath() {
    return (
      window.location.pathname ||
      '/'
    );
  }

  function inferBranchId(anchor) {
    const explicitBranchId =
      positiveNumber(
        anchor?.dataset?.branchId
      ) ||
      positiveNumber(
        anchor
          ?.closest('[data-branch-id]')
          ?.dataset?.branchId
      ) ||
      positiveNumber(
        getQueryValue('branch_id')
      );

    if (explicitBranchId) {
      return explicitBranchId;
    }

    const closestContainer =
      anchor?.closest(
        [
          '.branch-card',
          '.service-branch-item',
          '.branch-whatsapp-card',
        ].join(',')
      );

    const searchableText = [
      anchor?.href || '',
      anchor?.textContent || '',
      closestContainer?.textContent || '',
      closestContainer?.id || '',
    ]
      .join(' ')
      .toLowerCase();

    const matchedBranch =
      branchMatchers.find(
        (branch) =>
          branch.terms.some(
            (term) =>
              searchableText.includes(
                term
              )
          )
      );

    return matchedBranch?.id || null;
  }

  function inferServiceId(anchor) {
    return (
      positiveNumber(
        anchor?.dataset?.serviceId
      ) ||
      positiveNumber(
        anchor
          ?.closest('[data-service-id]')
          ?.dataset?.serviceId
      ) ||
      positiveNumber(
        getQueryValue('service_id')
      )
    );
  }

  async function sendEvent(
    payload,
    options = {}
  ) {
    const response = await fetch(
      `${API_BASE}/performance/events`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify(payload),

        keepalive: Boolean(
          options.keepalive
        ),
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
          : `Tracking failed with status ${response.status}.`;

      throw new Error(message);
    }

    return data;
  }

  function detectDeviceType() {
  if (
    navigator.userAgentData &&
    typeof navigator.userAgentData.mobile === 'boolean'
  ) {
    return navigator.userAgentData.mobile
      ? 'mobile'
      : 'desktop';
  }

  const userAgent = String(
    navigator.userAgent || ''
  );

  const mobilePattern =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

  return mobilePattern.test(userAgent)
    ? 'mobile'
    : 'desktop';
}

  async function track(
    eventType,
    details = {},
    options = {}
  ) {
    const payload = {
  event_type: eventType,

  device_type:
    details.device_type ||
    detectDeviceType(),

      branch_id:
        positiveNumber(
          details.branch_id
        ),

      service_id:
        positiveNumber(
          details.service_id
        ),

      session_key:
        details.session_key ||
        getSessionId(),

      event_key:
        details.event_key ||
        null,

      page_path:
        details.page_path ||
        currentPagePath(),
    };

    try {
      return await sendEvent(
        payload,
        options
      );
    } catch (error) {
      console.debug(
        'Performance event not recorded:',
        error.message
      );

      return null;
    }
  }

  function recordWebsiteVisit() {
    if (
      sessionStorage.getItem(
        VISIT_FLAG
      )
    ) {
      return;
    }

    const sessionId =
      getSessionId();

    track(
      'website_visit',
      {
        session_key:
          sessionId,

        event_key:
          `website_visit:${sessionId}`,
      }
    ).then((response) => {
      if (
        response?.tracked ||
        response?.duplicate
      ) {
        sessionStorage.setItem(
          VISIT_FLAG,
          '1'
        );
      }
    });
  }

  function getClickEventType(href) {
    const lowerHref =
      String(href || '')
        .trim()
        .toLowerCase();

    if (
      lowerHref.startsWith('tel:')
    ) {
      return 'call_click';
    }

    if (
      /wa\.me|wa\.link|api\.whatsapp\.com|web\.whatsapp\.com/.test(
        lowerHref
      )
    ) {
      return 'whatsapp_click';
    }

    if (
      /maps\.app\.goo\.gl|google\.[^/]+\/maps|goo\.gl\/maps/.test(
        lowerHref
      )
    ) {
      return 'direction_click';
    }

    return null;
  }

  function handleTrackedClick(event) {
    const target =
      event.target instanceof Element
        ? event.target
        : null;

    const anchor =
      target?.closest('a[href]');

    if (!anchor) {
      return;
    }

    const eventType =
      getClickEventType(
        anchor.href
      );

    if (!eventType) {
      return;
    }

    track(
      eventType,
      {
        branch_id:
          inferBranchId(anchor),

        service_id:
          inferServiceId(anchor),
      },
      {
        keepalive: true,
      }
    );
  }

  window.KPAnalytics = {
    track,
    getSessionId,
  };

  document.addEventListener(
    'click',
    handleTrackedClick,
    true
  );

  recordWebsiteVisit();
})();