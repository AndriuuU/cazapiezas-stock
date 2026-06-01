// src/services/tallergp.ts

import axios from "axios";

export const tallergp = axios.create({
  baseURL: process.env.NEXT_PUBLIC_TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_TALLERGP_TOKEN}`,
    "Content-Type": "application/json",
  },
});

// Error handling interceptor
tallergp.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("Unauthorized: Check your API token");
    } else if (error.response?.status === 404) {
      console.error("Resource not found");
    } else if (error.message === "Network Error") {
      console.error("Network error: Check your API URL");
    }
    return Promise.reject(error);
  }
);
