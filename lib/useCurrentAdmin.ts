"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";

export function useCurrentAdmin() {
  const [admin, setAdmin] = useState<{ id: string; role: "operator" | "shop_admin"; shop_id: string | null } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("admins").select("*").eq("id", authData.user.id).single();
      setAdmin(data);
      setLoading(false);
    })();
  }, []);

  return { admin, loading };
}
