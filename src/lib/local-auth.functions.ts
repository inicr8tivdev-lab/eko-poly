import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const localSignUp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { localAuthSignUp } = await import("./local-online-store.server");
    return localAuthSignUp(data.email, data.password);
  });

export const localSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { localAuthSignIn } = await import("./local-online-store.server");
    return localAuthSignIn(data.email, data.password);
  });

export const localGuestSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { localAuthGuest } = await import("./local-online-store.server");
    return localAuthGuest(data.name);
  });

export const localGetUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyLocalToken } = await import("./local-online-store.server");
    return verifyLocalToken(data.token);
  });
