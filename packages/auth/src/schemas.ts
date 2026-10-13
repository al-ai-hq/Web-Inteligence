import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(8).max(128);

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirm_password: passwordSchema,
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "password_mismatch",
    path: ["confirm_password"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
