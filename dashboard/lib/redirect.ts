import { z } from "zod";

/** Safe relative redirect target for post-login navigation (client-safe). */
export const RelativeRedirectSchema = z
  .string()
  .refine((v) => v.startsWith("/") && !v.startsWith("//") && !v.includes(":"), "Invalid redirect path");
