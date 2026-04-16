"use client";

import { useEffect } from "react";

export default function OAuthPopupCallbackPage() {
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
      <p className="text-sm">Finishing sign-in...</p>
    </main>
  );
}
