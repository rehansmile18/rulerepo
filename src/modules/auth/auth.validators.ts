import { z } from "zod";

// Named `email` for backward compatibility with every existing caller (both frontends, this
// repo's own tests) — but accepts the caller's email, username, OR mobile number interchangeably
// (see auth.service.ts's login, which tries all three). Loosened from `.email()` since it's no
// longer guaranteed to actually be an email address.
export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;
