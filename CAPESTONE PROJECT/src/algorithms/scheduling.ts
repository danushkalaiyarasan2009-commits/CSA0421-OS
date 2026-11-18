export type CpuAlgorithm = "FCFS" | "SJF" | "SRTF" | "Priority" | "Round Robin";
export type ProcessInput = { id: string; arrival: number; burst: number; priority: number };
export type ScheduleSegment = { id: string; start: number; end: number };
export type ProcessResult = ProcessInput & {
  completion: number;
  turnaround: number;
  waiting: number;
  response: number;
};
export type ScheduleResult = {
  algorithm: CpuAlgorithm;
  segments: ScheduleSegment[];
  processes: ProcessResult[];
  averageWaiting: number;
  averageTurnaround: number;
};

function appendSegment(segments: ScheduleSegment[], id: string, start: number, end: number) {
  const last = segments[segments.length - 1];
  if (last && last.id === id && last.end === start) last.end = end;
  else segments.push({ id, start, end });
}

export function simulateCpu(algorithm: CpuAlgorithm, input: ProcessInput[], quantum = 2): ScheduleResult {
  if (!input.length) throw new Error("Add at least one process to run a simulation.");
  if (algorithm === "Round Robin" && (!Number.isInteger(quantum) || quantum < 1)) throw new Error("Time quantum must be a positive whole number.");
  const processes = input.map((p) => ({ ...p, remaining: p.burst, firstStart: null as number | null, completion: 0 }));
  const segments: ScheduleSegment[] = [];
  let time = Math.min(...processes.map((p) => p.arrival));
  let finished = 0;
  const byArrival = [...processes].sort((a, b) => a.arrival - b.arrival || a.id.localeCompare(b.id));

  if (algorithm === "FCFS" || algorithm === "SJF" || algorithm === "Priority") {
    const pending = new Set(processes);
    while (pending.size) {
      const ready = [...pending].filter((p) => p.arrival <= time);
      if (!ready.length) {
        const next = Math.min(...[...pending].map((p) => p.arrival));
        if (next > time) appendSegment(segments, "Idle", time, next);
        time = next;
        continue;
      }
      ready.sort((a, b) => {
        if (algorithm === "SJF") return a.burst - b.burst || a.arrival - b.arrival || a.id.localeCompare(b.id);
        if (algorithm === "Priority") return a.priority - b.priority || a.arrival - b.arrival || a.id.localeCompare(b.id);
        return a.arrival - b.arrival || a.id.localeCompare(b.id);
      });
      const p = ready[0];
      if (p.firstStart === null) p.firstStart = time;
      appendSegment(segments, p.id, time, time + p.burst);
      time += p.burst;
      p.remaining = 0;
      p.completion = time;
      pending.delete(p);
    }
  } else if (algorithm === "SRTF") {
    while (finished < processes.length) {
      const ready = processes.filter((p) => p.remaining > 0 && p.arrival <= time);
      if (!ready.length) {
        const next = Math.min(...processes.filter((p) => p.remaining > 0).map((p) => p.arrival));
        if (next > time) appendSegment(segments, "Idle", time, next);
        time = next;
        continue;
      }
      ready.sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival || a.id.localeCompare(b.id));
      const p = ready[0];
      if (p.firstStart === null) p.firstStart = time;
      appendSegment(segments, p.id, time, time + 1);
      p.remaining -= 1;
      time += 1;
      if (p.remaining === 0) {
        p.completion = time;
        finished += 1;
      }
    }
  } else {
    const queue: typeof processes = [];
    let index = 0;
    while (finished < processes.length) {
      while (index < byArrival.length && byArrival[index].arrival <= time) queue.push(byArrival[index++]);
      if (!queue.length) {
        const next = byArrival[index].arrival;
        if (next > time) appendSegment(segments, "Idle", time, next);
        time = next;
        continue;
      }
      const p = queue.shift()!;
      if (p.firstStart === null) p.firstStart = time;
      const runFor = Math.min(quantum, p.remaining);
      appendSegment(segments, p.id, time, time + runFor);
      time += runFor;
      p.remaining -= runFor;
      while (index < byArrival.length && byArrival[index].arrival <= time) queue.push(byArrival[index++]);
      if (p.remaining > 0) queue.push(p);
      else {
        p.completion = time;
        finished += 1;
      }
    }
  }

  const result = processes.map(({ remaining: _remaining, firstStart, ...p }) => {
    const turnaround = p.completion - p.arrival;
    return { ...p, turnaround, waiting: turnaround - p.burst, response: (firstStart ?? p.arrival) - p.arrival };
  });
  return {
    algorithm, segments, processes: result,
    averageWaiting: result.reduce((sum, p) => sum + p.waiting, 0) / result.length,
    averageTurnaround: result.reduce((sum, p) => sum + p.turnaround, 0) / result.length
  };
}
