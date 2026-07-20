import { z } from "zod";
import { USER_ROLES } from "../../types/domain";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
  clientId: z.string().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const listUsersQuerySchema = z.object({
  clientId: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
