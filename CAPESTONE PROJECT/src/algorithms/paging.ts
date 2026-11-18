export type PageAlgorithm = "FIFO" | "LRU" | "Optimal";
export type PageStep = { page: number; frames: (number | null)[]; hit: boolean; replaced: number | null };
export type PageResult = { steps: PageStep[]; hits: number; faults: number; hitRatio: number; faultRatio: number };

export function simulatePages(algorithm: PageAlgorithm, reference: number[], frameCount: number): PageResult {
  if (!reference.length) throw new Error("Enter a page reference string.");
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 12) throw new Error("Frame count must be between 1 and 12.");
  const frames: (number | null)[] = Array(frameCount).fill(null);
  const steps: PageStep[] = [];
  const lastUsed = new Map<number, number>();
  let fifoPointer = 0;
  let hits = 0;
  reference.forEach((page, index) => {
    const present = frames.includes(page);
    let replaced: number | null = null;
    if (present) hits += 1;
    else {
      let slot = frames.indexOf(null);
      if (slot < 0 && algorithm === "FIFO") {
        slot = fifoPointer;
        fifoPointer = (fifoPointer + 1) % frameCount;
      } else if (slot < 0 && algorithm === "LRU") {
        slot = frames.reduce<number>((best, value, i) =>
          lastUsed.get(value!)! < lastUsed.get(frames[best]!)! ? i : best, 0);
      } else if (slot < 0) {
        slot = frames.reduce<number>((best, value, i) => {
          const next = reference.indexOf(value!, index + 1);
          const bestNext = reference.indexOf(frames[best]!, index + 1);
          return next === -1 || (bestNext !== -1 && next > bestNext) ? i : best;
        }, 0);
      }
      replaced = frames[slot];
      frames[slot] = page;
    }
    lastUsed.set(page, index);
    steps.push({ page, frames: [...frames], hit: present, replaced });
  });
  const faults = reference.length - hits;
  return { steps, hits, faults, hitRatio: hits / reference.length, faultRatio: faults / reference.length };
}
