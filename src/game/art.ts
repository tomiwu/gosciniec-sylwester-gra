export type GameArt = {
  readonly skyline: HTMLImageElement;
  readonly clockRing: HTMLImageElement;
  readonly coupleIdle: HTMLImageElement;
  readonly coupleLeft: HTMLImageElement;
  readonly coupleRight: HTMLImageElement;
  readonly coupleCatch: HTMLImageElement;
  readonly itemGlass: HTMLImageElement;
  readonly itemStar: HTMLImageElement;
  readonly itemClock: HTMLImageElement;
  readonly itemObstacle: HTMLImageElement;
};

const FILES: { readonly [K in keyof GameArt]: string } = {
  skyline: "assets/skyline-portrait.jpg",
  clockRing: "assets/clock-ring.webp",
  coupleIdle: "assets/couple-idle.webp",
  coupleLeft: "assets/couple-left.webp",
  coupleRight: "assets/couple-right.webp",
  coupleCatch: "assets/couple-catch.webp",
  itemGlass: "assets/item-glass.webp",
  itemStar: "assets/item-star.webp",
  itemClock: "assets/item-clock.webp",
  itemObstacle: "assets/item-obstacle.webp",
};

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

/** Load skyline, clock, couple poses and item sprites. Fail if any file is missing. */
export function loadArt(): Promise<GameArt> {
  const keys = Object.keys(FILES) as (keyof GameArt)[];
  return Promise.all(keys.map((key) => loadImage(assetUrl(FILES[key])))).then(
    (images) => {
      const art = {} as Record<keyof GameArt, HTMLImageElement>;
      for (let i = 0; i < keys.length; i += 1) {
        art[keys[i]!] = images[i]!;
      }
      return art;
    },
  );
}

export function logoUrl(): string {
  return assetUrl("assets/logo-gold.webp");
}
