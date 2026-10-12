// Deterministic random numbers for the sky (spec 005, RF-1). The generator is
// always passed in as a parameter: nothing here uses Math.random or the date.

/** Generator of numbers in [0, 1). */
export type Rng = () => number;

/** mulberry32: a small, fast seeded generator. Same seed, same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** One element of `list`, chosen by the generator. Throws on an empty list. */
export function pick<T>(rng: Rng, list: readonly T[]): T {
  if (list.length === 0) throw new Error("pick needs a non-empty list");
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
}
