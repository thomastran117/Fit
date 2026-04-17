"use client";

import { useEffect } from "react";

export function OAuthPopupFinish() {
  useEffect(() => {
    if (!window.opener) {
      return;
    }

    const payload = window.location.hash || window.location.search;

    window.opener.postMessage(
      {
        source: "rentify-oauth-popup",
        payload,
      },
      window.location.origin,
    );

    window.close();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-6 text-slate-700">
      <div className="rounded-full border border-white/80 bg-white/90 px-5 py-3 text-sm font-medium shadow-lg backdrop-blur">
        Finishing sign-in...
      </div>
    </main>
  );
}
