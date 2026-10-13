import axios from "axios";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com"
)
  .trim()
  .replace(/^=+/, "")
  .replace(/\/+$/, "");

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 30 * 1000;
const SESSION_CHECK_MS = 30 * 1000;

let started = false;
let lastRecordedActivity = 0;
let refreshPromise = null;
let checkTimer = null;

function now() {
  return Date.now();
}

function getLastActivity() {
  const raw = localStorage.getItem("lastActivityAt");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function setLastActivity(timestamp = now()) {
  localStorage.setItem("lastActivityAt", String(timestamp));
  lastRecordedActivity = timestamp;
}

function hasSession() {
  return Boolean(
    localStorage.getItem("token") &&
      localStorage.getItem("user")
  );
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("lastActivityAt");
}

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

export function markSessionActivity(force = false) {
  if (!hasSession()) return;

  const current = now();
  if (
    !force &&
    current - lastRecordedActivity <
      ACTIVITY_THROTTLE_MS
  ) {
    return;
  }

  setLastActivity(current);
}

export function getIdleTime() {
  const lastActivity = getLastActivity();
  if (!lastActivity) return 0;
  return Math.max(0, now() - lastActivity);
}

export function isSessionIdle() {
  return getIdleTime() >= IDLE_TIMEOUT_MS;
}

export function logoutDueToInactivity() {
  clearSession();
  redirectToLogin();
}

async function refreshAccessToken() {
  if (!hasSession()) return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = axios
    .post(
      `${API_URL}/api/auth/refresh`,
      {},
      {
        withCredentials: true,
        __skipAuthRefresh: true,
      }
    )
    .then(({ data }) => {
      if (!data?.success || !data?.token) {
        throw new Error("Refresh failed.");
      }

      localStorage.setItem("token", data.token);

      if (data.user) {
        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );
      }

      markSessionActivity(true);
      return true;
    })
    .catch(() => {
      clearSession();
      redirectToLogin();
      return false;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function isPublicAuthUrl(url = "") {
  return (
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/forgot-password/") ||
    url.includes("/api/auth/refresh")
  );
}

async function ensureActiveSession() {
  if (!hasSession()) return true;

  if (isSessionIdle()) {
    logoutDueToInactivity();
    return false;
  }

  return true;
}

function installAxiosInterceptors() {
  axios.interceptors.request.use(
    async (config) => {
      if (config.__skipIdleGuard) {
        return config;
      }

      if (!isPublicAuthUrl(config.url || "")) {
        const active = await ensureActiveSession();
        if (!active) {
          return Promise.reject(
            new axios.Cancel("Session expired due to inactivity.")
          );
        }
      }

      const token = localStorage.getItem("token");

      if (token && !isPublicAuthUrl(config.url || "")) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (hasSession()) {
        markSessionActivity(false);
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error?.config;

      if (!originalRequest) {
        return Promise.reject(error);
      }

      if (
        error?.response?.status !== 401 ||
        originalRequest.__isRetryRequest ||
        originalRequest.__isRefreshRequest ||
        isPublicAuthUrl(originalRequest.url || "") ||
        !hasSession()
      ) {
        return Promise.reject(error);
      }

      if (isSessionIdle()) {
        logoutDueToInactivity();
        return Promise.reject(error);
      }

      originalRequest.__isRetryRequest = true;

      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        return Promise.reject(error);
      }

      const newToken =
        localStorage.getItem("token");

      originalRequest.headers =
        originalRequest.headers || {};

      if (newToken) {
        originalRequest.headers.Authorization =
          `Bearer ${newToken}`;
      }

      return axios(originalRequest);
    }
  );
}

function installFetchInterceptor() {
  const originalFetch = window.fetch.bind(window);
  const apiOrigin = new URL(API_URL).origin;

  window.fetch = async (input, init) => {
    const requestUrl = new URL(
      input instanceof Request ? input.url : String(input),
      window.location.href
    );

    if (requestUrl.origin !== apiOrigin || isPublicAuthUrl(requestUrl.href)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    const token = localStorage.getItem("token");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const request = new Request(input, {
      ...init,
      headers,
      credentials: "include",
    });
    const retryRequest = request.clone();
    const response = await originalFetch(request);

    if (response.status !== 401 || !hasSession()) return response;

    const payload = await response.clone().json().catch(() => null);
    if (payload?.message !== "Authentication token expired.") return response;

    if (isSessionIdle()) {
      logoutDueToInactivity();
      return response;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) return response;

    const retryHeaders = new Headers(retryRequest.headers);
    const refreshedToken = localStorage.getItem("token");
    if (refreshedToken) {
      retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
    }

    return originalFetch(new Request(retryRequest, {headers:retryHeaders}));
  };
}

function installActivityListeners() {
  const events = [
    "click",
    "keydown",
    "mousemove",
    "scroll",
    "touchstart",
    "pointerdown",
  ];

  const handler = () => {
    markSessionActivity(false);
  };

  events.forEach((eventName) => {
    window.addEventListener(
      eventName,
      handler,
      { passive: true }
    );
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "lastActivityAt") {
      lastRecordedActivity = Number(
        event.newValue || 0
      );
    }

    if (
      event.key === "token" &&
      !event.newValue
    ) {
      redirectToLogin();
    }
  });
}

function startIdleMonitor() {
  if (checkTimer) {
    clearInterval(checkTimer);
  }

  checkTimer = window.setInterval(() => {
    if (!hasSession()) return;

    if (isSessionIdle()) {
      logoutDueToInactivity();
    }
  }, SESSION_CHECK_MS);
}

export function startSessionManager() {
  if (started || typeof window === "undefined") {
    return;
  }

  started = true;

  installAxiosInterceptors();
  installFetchInterceptor();
  installActivityListeners();
  startIdleMonitor();

  if (hasSession()) {
    const current = getLastActivity();

    if (!current) {
      setLastActivity(now());
    } else if (now() - current >= IDLE_TIMEOUT_MS) {
      logoutDueToInactivity();
    } else {
      lastRecordedActivity = current;
    }
  }
}

export const SESSION_IDLE_TIMEOUT_MINUTES = 60;
export const SESSION_IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MS;
