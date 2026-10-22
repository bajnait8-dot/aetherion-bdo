import Link from "next/link";
import { ShieldAlert, ArrowLeft, UserPlus, RefreshCw, Info } from "lucide-react";
import { YenidenDene } from "./yeniden-dene";

/**
 * Giriş başarısız sayfası.
 *
 * NextAuth bütün hatalarını buraya yolluyor (`pages.error`). Eskiden hepsi
 * "Erişim Reddedildi — Discord sunucusunda üye olman gerekiyor" diyordu;
 * oysa hataların çoğu geçici: state çerezi düşmüş, sekme beklemiş, iki
 * giriş birden başlatılmış. İnsanlar klandan atıldıklarını sanıp yazıyordu.
 *
 * Artık ikisi ayrı: gerçek yetki reddi (`AccessDenied` ya da parametresiz
 * geliş — signIn geri çağrısı rol bulamayınca buraya düz yönlendiriyor) ve
 * teknik aksaklık (tekrar dene).
 */

/** Gerçekten "sen giremezsin" demek olan durumlar */
const YETKI_REDDI = new Set(["AccessDenied", "undefined", ""]);

const ACIKLAMA: Record<string, string> = {
  OAuthCallback: "Discord'dan dönerken oturum doğrulaması elimizden kaçtı. Genelde giriş sayfası uzun süre açık kaldığında ya da aynı anda iki giriş başlatıldığında oluyor.",
  OAuthSignin: "Discord'a yönlendirme kurulamadı.",
  Callback: "Giriş tamamlanırken bir aksaklık oldu.",
  OAuthAccountNotLinked: "Bu Discord hesabı başka bir kayıtla eşleşmiş görünüyor.",
  SessionRequired: "Oturumun sona ermiş.",
  Configuration: "Sunucu tarafında bir yapılandırma sorunu var.",
  Verification: "Doğrulama bağlantısı geçersiz ya da süresi dolmuş.",
};

export default function DeniedPage({ searchParams }: { searchParams?: { error?: string } }) {
  const kod = searchParams?.error ?? "";
  const yetkiReddi = YETKI_REDDI.has(kod);

  if (yetkiReddi) {
    return (
      <Kabuk ikon={<ShieldAlert className="w-6 h-6 text-red-400" strokeWidth={1.75} />} renk="red"
             baslik="Erişim Reddedildi"
             metin="Bu siteye erişebilmek için Aetherion Discord sunucusunda üye olman ve gerekli role sahip olman gerekiyor.">
        <Link href="/basvuru"
              className="inline-flex items-center gap-2 bg-gradient-to-b from-[#e0b040] to-[#c29328] text-bdo-bg font-semibold px-4 py-2 rounded-lg text-[13px] hover:from-[#e8bb4d] hover:to-[#cc9c2c] transition-colors">
          <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
          Klana Başvur
        </Link>
        <Geri />
      </Kabuk>
    );
  }

  return (
    <Kabuk ikon={<RefreshCw className="w-6 h-6 text-bdo-gold" strokeWidth={1.75} />} renk="gold"
           baslik="Giriş tamamlanamadı"
           metin={ACIKLAMA[kod] ?? "Giriş sırasında beklenmedik bir şey oldu."}>
      <YenidenDene />
      <p className="mt-4 text-[12px] text-bdo-text-muted flex items-center justify-center gap-1.5">
        <Info className="w-3 h-3" strokeWidth={2} />
        Yine olmazsa tarayıcıyı kapatıp açmayı dene.
      </p>
      <Geri />
      <p className="mt-6 text-[11px] text-bdo-text-muted/60">hata kodu: {kod || "bilinmiyor"}</p>
    </Kabuk>
  );
}

function Kabuk({ ikon, renk, baslik, metin, children }: {
  ikon: React.ReactNode; renk: "red" | "gold"; baslik: string; metin: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bdo-bg px-6">
      <div className="text-center max-w-sm">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
          renk === "red" ? "bg-red-500/10 border border-red-500/20" : "bg-[#e0b040]/10 border border-[#e0b040]/25"}`}>
          {ikon}
        </div>
        <h1 className="text-xl font-bold text-bdo-text-primary mb-2">{baslik}</h1>
        <p className="text-[13px] text-bdo-text-muted leading-relaxed mb-6">{metin}</p>
        {children}
      </div>
    </div>
  );
}

const Geri = () => (
  <div className="mt-4">
    <Link href="/"
          className="inline-flex items-center gap-2 text-[13px] text-bdo-text-secondary hover:text-bdo-gold transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
      Giriş sayfasına dön
    </Link>
  </div>
);
