export type GameArt = {
  readonly views: readonly HTMLImageElement[];
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

const VIEW_FILES = [
  "assets/view-hall.webp",
  "assets/view-church.webp",
  "assets/view-castle.webp",
  "assets/view-termy.webp",
  "assets/view-aerial.webp",
] as const;

const SPRITES = {
  clockRing: "assets/clock-ring.webp",
  coupleIdle: "assets/couple-idle.webp",
  coupleLeft: "assets/couple-left.webp",
  coupleRight: "assets/couple-right.webp",
  coupleCatch: "assets/couple-catch.webp",
  itemGlass: "assets/item-glass.webp",
  itemStar: "assets/item-star.webp",
  itemClock: "assets/item-clock.webp",
  itemObstacle: "assets/item-obstacle.webp",
} as const;

type SpriteKey = keyof typeof SPRITES;

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

/** Load backdrop views, clock, couple poses and item sprites. Fail if any file is missing. */
export function loadArt(): Promise<GameArt> {
  const spriteKeys = Object.keys(SPRITES) as SpriteKey[];
  const viewLoads = VIEW_FILES.map((file) => loadImage(assetUrl(file)));
  const spriteLoads = spriteKeys.map((key) =>
    loadImage(assetUrl(SPRITES[key])),
  );
  return Promise.all([...viewLoads, ...spriteLoads]).then((images) => {
    const views = images.slice(0, VIEW_FILES.length);
    const at = (index: number) => images[VIEW_FILES.length + index]!;
    return {
      views,
      clockRing: at(0),
      coupleIdle: at(1),
      coupleLeft: at(2),
      coupleRight: at(3),
      coupleCatch: at(4),
      itemGlass: at(5),
      itemStar: at(6),
      itemClock: at(7),
      itemObstacle: at(8),
    };
  });
}

export function logoUrl(): string {
  return assetUrl("assets/logo-gold.webp");
}
