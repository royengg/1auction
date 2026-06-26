import axios, { type AxiosInstance, type AxiosError } from "axios";

const baseURL =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

const api: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith("/sign-in") && !currentPath.startsWith("/sign-up")) {
        const redirect = encodeURIComponent(currentPath);
        window.location.href = `/sign-in?redirect=${redirect}`;
      }
    }
    return Promise.reject(error);
  },
);

export { api };