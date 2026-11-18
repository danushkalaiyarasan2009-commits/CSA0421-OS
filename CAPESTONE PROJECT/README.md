# KernelScope Lite

An interactive operating-systems lab for CPU scheduling, page replacement, and disk scheduling.

## Run locally

```bash
npm install
npm run dev
```

## Simulators

- **CPU scheduling:** FCFS, non-preemptive SJF, preemptive SRTF, non-preemptive Priority (lower number wins), and Round Robin.
- **Page replacement:** FIFO, LRU, and Optimal, with step-by-step frame states and hit/fault ratios.
- **Disk scheduling:** FCFS, SSTF, SCAN, C-SCAN, LOOK, and C-LOOK, with request order and head movement.

Algorithm implementations are in `src/algorithms/`. Inputs are validated before simulation. Results, comparison charts, analytics, and CSV exports are derived from simulation data in the current session.

The Linux terminal is an educational simulator with a fixed set of commands. It does not execute shell commands on the host machine.

## Build

```bash
npm run build
```
