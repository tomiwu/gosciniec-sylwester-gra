/** Player-facing text. Keep this the only Polish in the source tree. */
export const pl = {
  hotel: "Gościniec Uniejów",
  title: "Sylwester 2026/2027",
  subtitle: "Oferta dla par",
  play: "Graj",
  playAgain: "Zagraj jeszcze raz",
  mute: "Dźwięk",
  muted: "Wyciszono",
  score: "Wynik",
  best: "Rekord",
  time: "Do północy",
  midnight: "Północ!",
  enterName: "Twój nick (max 16 znaków)",
  saveScore: "Zapisz wynik",
  share: "Udostępnij wynik",
  leaderboard: "Najlepsi gracze",
  book: "Zarezerwuj",
  offerPrice: "599 zł / para",
  offerWas: "740 zł",
  discountUnlocked: "Kod zniżki 10% na bilet",
  discountReferral: "Kod zniżki 20% na bilet",
  discountLocked: "Zdobądź więcej punktów, żeby otrzymać kod zniżki.",
  yourCode: "Twój kod",
  referralProgress: "Polecenia",
  copyLink: "Skopiuj link polecający",
  howTo:
    "Przesuwaj parę w lewo i w prawo. Łap przedmioty. Omijaj przeszkody. Seria złowień spowalnia zegar.",
  localOnly: "Wyniki zapisujemy lokalnie, dopóki hotel nie podłączy serwera.",
} as const;

export type PlKey = keyof typeof pl;
