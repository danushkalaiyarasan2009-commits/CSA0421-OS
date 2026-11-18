export type DiskAlgorithm = "FCFS" | "SSTF" | "SCAN" | "C-SCAN" | "LOOK" | "C-LOOK";
export type DiskDirection = "right" | "left";
export type DiskResult = { sequence: number[]; totalMovement: number; averageMovement: number };

export function simulateDisk(
  algorithm: DiskAlgorithm, requests: number[], head: number, diskSize: number, direction: DiskDirection
): DiskResult {
  if (!requests.length) throw new Error("Enter at least one disk request.");
  if (!Number.isInteger(diskSize) || diskSize < 2) throw new Error("Disk size must be at least 2 cylinders.");
  if (!Number.isInteger(head) || head < 0 || head >= diskSize) throw new Error("Head position must be within the disk.");
  if (requests.some((r) => !Number.isInteger(r) || r < 0 || r >= diskSize)) throw new Error("Every request must be within the disk range.");
  const sequence: number[] = [];
  if (algorithm === "FCFS") sequence.push(...requests);
  else if (algorithm === "SSTF") {
    let current = head;
    const pending = [...requests];
    while (pending.length) {
      let best = 0;
      pending.forEach((request, i) => {
        if (Math.abs(request - current) < Math.abs(pending[best] - current)) best = i;
      });
      current = pending.splice(best, 1)[0];
      sequence.push(current);
    }
  } else {
    const left = requests.filter((r) => r < head).sort((a, b) => b - a);
    const right = requests.filter((r) => r >= head).sort((a, b) => a - b);
    const goRight = direction === "right";
    if (algorithm === "SCAN") {
      if (goRight) sequence.push(...right, diskSize - 1, ...left);
      else sequence.push(...left, 0, ...right);
    } else if (algorithm === "C-SCAN") {
      if (goRight) sequence.push(...right, diskSize - 1, 0, ...left.slice().reverse());
      else sequence.push(...left, 0, diskSize - 1, ...right.slice().reverse());
    } else if (algorithm === "LOOK") {
      if (goRight) sequence.push(...right, ...left);
      else sequence.push(...left, ...right);
    } else if (goRight) sequence.push(...right, ...left.slice().reverse());
    else sequence.push(...left, ...right.slice().reverse());
  }
  const totalMovement = sequence.reduce((sum, position, index) =>
    sum + Math.abs(position - (index === 0 ? head : sequence[index - 1])), 0);
  return { sequence, totalMovement, averageMovement: totalMovement / requests.length };
}
