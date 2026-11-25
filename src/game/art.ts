export type GameArt = {
  readonly skyline: HTMLImageElement;
  readonly clockRing: HTMLImageElement;
  readonly coupleIdle: HTMLImageElement;
  readonly coupleLeft: HTMLImageElement;
  readonly coupleRight: HTMLImageElement;
  readonly coupleCatch: HTMLImageElement;
};

const FILES = {
  skyline: "assets/skyline-portrait.jpg",
  clockRing: "assets/clock-ring.webp",
  coupleIdle: "assets/couple-idle.webp",
  coupleLeft: "assets/couple-left.webp",
  coupleRight: "assets/couple-right.webp",
  coupleCatch: "assets/couple-catch.webp",
} as const;

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${path}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Art failed to load: ${src}`));
    img.src = src;
  });
}

/** Load the skyline, clock ring and couple poses. Fail if any file is missing. */
export function loadArt(): Promise<GameArt> {
  return Promise.all([
    loadImage(assetUrl(FILES.skyline)),
    loadImage(assetUrl(FILES.clockRing)),
    loadImage(assetUrl(FILES.coupleIdle)),
    loadImage(assetUrl(FILES.coupleLeft)),
    loadImage(assetUrl(FILES.coupleRight)),
    loadImage(assetUrl(FILES.coupleCatch)),
  ]).then(
    ([
      skyline,
      clockRing,
      coupleIdle,
      coupleLeft,
      coupleRight,
      coupleCatch,
    ]) => ({
      skyline,
      clockRing,
      coupleIdle,
      coupleLeft,
      coupleRight,
      coupleCatch,
    }),
  );
}

export function logoUrl(): string {
  return assetUrl("assets/logo-gold.webp");
}
