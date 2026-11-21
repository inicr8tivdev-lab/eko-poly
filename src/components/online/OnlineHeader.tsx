import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import icon from "@/assets/ekopoly-icon.png";

export function OnlineHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
      <Link to="/" className="flex items-center gap-3">
        <img src={icon} alt="" width={36} height={36} className="size-9" />
        <span className="font-display text-lg font-black tracking-tight text-primary">EKOPOLY</span>
      </Link>
      <Button variant="ghost" size="sm" onClick={signOut}>
        <LogOut /> Sign out
      </Button>
    </header>
  );
}

