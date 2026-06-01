// src/services/tallergp.ts

import axios from "axios";

export const tallergp = axios.create({
  baseURL: process.env.NEXT_PUBLIC_TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_TALLERGP_TOKEN}`,
    "Content-Type": "application/json",
  },
});