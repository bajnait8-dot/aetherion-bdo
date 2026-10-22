"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { RefreshCw } from "lucide-react";

/**
 * Yeniden deneme — yeni bir giriş akışı başlatır, yani taze bir state
 * çerezi yazılır. "State cookie was missing" hatasının pratikteki çözümü
 * bu: kişinin elle çerez temizlemesine gerek yok.
 */
export function YenidenDene() {
  const [mesgul, setMesgul] = useState(false);
  return (
    <button
      onClick={() => { setMesgul(true); void signIn("discord", { callbackUrl: "/panel" }); }}
      disabled={mesgul}
      className="inline-flex items-center gap-2 bg-gradient-to-b from-[#e0b040] to-[#c29328] text-bdo-bg font-semibold px-4 py-2 rounded-lg text-[13px] hover:from-[#e8bb4d] hover:to-[#cc9c2c] transition-colors disabled:opacity-60"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${mesgul ? "animate-spin" : ""}`} strokeWidth={2} />
      {mesgul ? "Yönlendiriliyor…" : "Tekrar giriş yap"}
    </button>
  );
}
