import axios from "axios";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStorage";

const baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  (process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : "http://localhost:8000/api");

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent("kevin-auth:unauthorized"));
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      notifyUnauthorized();
      return Promise.reject(error);
    }

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${baseURL}/auth/refresh`, { refresh_token: refreshToken })
        .then((response) => {
          setTokens({
            access_token: response.data.access_token,
            refresh_token: refreshToken,
          });
          return response.data.access_token;
        })
        .catch((refreshError) => {
          clearTokens();
          notifyUnauthorized();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const nextAccessToken = await refreshPromise;
    originalRequest._retry = true;
    originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
    return api(originalRequest);
  },
);
