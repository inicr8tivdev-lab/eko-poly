import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };

      const status = error && "status" in error ? Number(error.status) : 0;
      const msg = error?.message?.toLowerCase() ?? "";
      const isHardAuthError =
        status === 401 || status === 403 || msg.includes("jwt") || msg.includes("invalid");

      if (sessionData.session?.user && !isHardAuthError) {
        return { user: sessionData.session.user };
      }

      if (sessionData.session) {
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshed.user) return { user: refreshed.user };
        await supabase.auth.signOut().catch(() => {});
      }

      throw redirect({ to: "/auth", search: { redirect: location.href } });
    } catch (err) {
      if (err && typeof err === "object" && "isRedirect" in err) throw err;
      if (err instanceof Response) throw err;
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
