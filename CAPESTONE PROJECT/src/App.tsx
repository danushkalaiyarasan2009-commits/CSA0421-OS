import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, CircleAlert, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Cpu, Database, Download, Gauge, HardDrive, History, Layers3,
  LayoutDashboard, LoaderCircle, Menu, Play, RotateCcw, Search, Server, Settings2, Terminal, X, Zap
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { simulateCpu, type CpuAlgorithm, type ProcessInput, type ScheduleResult } from "./algorithms/scheduling";
import { simulatePages, type PageAlgorithm, type PageResult } from "./algorithms/paging";
import { simulateDisk, type DiskAlgorithm, type DiskDirection, type DiskResult } from "./algorithms/disk";

type View = "Dashboard" | "CPU Scheduling" | "Page Replacement" | "Disk Scheduling" | "Algorithm Comparison" | "Performance Analytics" | "Linux Terminal" | "About Project";
type RunRecord = { category: string; algorithm: string; metric: string; value: number; time: string };
type CpuChartPoint = { algorithm: string; "Avg. waiting": number; "Avg. turnaround": number };
const navItems: { label: View; icon: typeof LayoutDashboard; group: string }[] = [
  { label: "Dashboard", icon: LayoutDashboard, group: "Workspace" },
  { label: "CPU Scheduling", icon: Cpu, group: "Simulators" },
  { label: "Page Replacement", icon: Layers3, group: "Simulators" },
  { label: "Disk Scheduling", icon: HardDrive, group: "Simulators" },
  { label: "Algorithm Comparison", icon: BarChart3, group: "Insights" },
  { label: "Performance Analytics", icon: Activity, group: "Insights" },
  { label: "Linux Terminal", icon: Terminal, group: "System" },
  { label: "About Project", icon: BookOpen, group: "System" }
];
const cpuAlgorithms: CpuAlgorithm[] = ["FCFS", "SJF", "SRTF", "Priority", "Round Robin"];
const pageAlgorithms: PageAlgorithm[] = ["FIFO", "LRU", "Optimal"];
const diskAlgorithms: DiskAlgorithm[] = ["FCFS", "SSTF", "SCAN", "C-SCAN", "LOOK", "C-LOOK"];
const palette = ["#54d6ff", "#9d83ff", "#f7b955", "#ff7189", "#63e6be", "#74a7ff"];
const sampleProcesses: ProcessInput[] = [
  { id: "P1", arrival: 0, burst: 7, priority: 2 },
  { id: "P2", arrival: 2, burst: 4, priority: 1 },
  { id: "P3", arrival: 4, burst: 1, priority: 3 },
  { id: "P4", arrival: 5, burst: 4, priority: 2 }
];
const defaultReferences = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2];
const defaultRequests = [98, 183, 37, 122, 14, 124, 65, 67];

function format(value: number, digits = 1) { return Number(value.toFixed(digits)).toString(); }
function timeLabel() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function csvDownload(filename: string, rows: (string | number)[][]) {
  const content = rows.map((row) => row.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function App() {
  const [view, setView] = useState<View>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [processes, setProcesses] = useState<ProcessInput[]>(sampleProcesses);
  const [cpuAlgorithm, setCpuAlgorithm] = useState<CpuAlgorithm>("SRTF");
  const [quantum, setQuantum] = useState(2);
  const [cpuResult, setCpuResult] = useState<ScheduleResult | null>(null);
  const [references, setReferences] = useState(defaultReferences.join(", "));
  const [frameCount, setFrameCount] = useState(3);
  const [pageAlgorithm, setPageAlgorithm] = useState<PageAlgorithm>("LRU");
  const [pageResult, setPageResult] = useState<PageResult | null>(null);
  const [pageStep, setPageStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [requests, setRequests] = useState(defaultRequests.join(", "));
  const [head, setHead] = useState(53);
  const [diskSize, setDiskSize] = useState(200);
  const [direction, setDirection] = useState<DiskDirection>("right");
  const [diskAlgorithm, setDiskAlgorithm] = useState<DiskAlgorithm>("SCAN");
  const [diskResult, setDiskResult] = useState<DiskResult | null>(null);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "KernelScope educational shell [Version 1.0.0]",
    "Type 'help' to see available commands.",
    ""
  ]);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [terminalCursor, setTerminalCursor] = useState(-1);
  const notify = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  };
  const switchView = (next: View) => {
    setView(next);
    setMobileMenu(false);
  };
  const runWithLoading = (action: () => void) => {
    if (simulating) return;
    setSimulating(true);
    window.setTimeout(() => {
      try { action(); }
      finally { setSimulating(false); }
    }, 140);
  };

  const chartData = useMemo<CpuChartPoint[]>(() => {
    if (!processes.length || processes.length > 20 || processes.some((p) => !p.id.trim() || !Number.isInteger(p.arrival) || p.arrival < 0 || p.arrival > 1000 || !Number.isInteger(p.burst) || p.burst < 1 || p.burst > 1000 || !Number.isInteger(p.priority)) || new Set(processes.map((p) => p.id)).size !== processes.length || processes.reduce((sum, p) => sum + p.burst, 0) > 2000) return [];
    return cpuAlgorithms.map((algorithm) => {
      const result = simulateCpu(algorithm, processes, quantum);
      return { algorithm: algorithm === "Round Robin" ? "RR" : algorithm, "Avg. waiting": Number(result.averageWaiting.toFixed(2)), "Avg. turnaround": Number(result.averageTurnaround.toFixed(2)) };
    });
  }, [processes, quantum]);
  const pageSteps = pageResult?.steps ?? [];
  const visibleStep = pageSteps[Math.min(pageStep, Math.max(0, pageSteps.length - 1))];
  const pageReferenceNumbers = references.split(/[,\s]+/).filter(Boolean).map(Number);
  const diskRequestNumbers = requests.split(/[,\s]+/).filter(Boolean).map(Number);
  useEffect(() => {
    if (!isPlaying || !pageResult) return;
    const timer = window.setInterval(() => {
      setPageStep((current) => {
        if (current >= pageResult.steps.length - 1) { setIsPlaying(false); return current; }
        return current + 1;
      });
    }, 750);
    return () => window.clearInterval(timer);
  }, [isPlaying, pageResult]);

  const runCpu = () => {
    try {
      if (!processes.length || processes.length > 20 || processes.some((p) => !p.id.trim() || !Number.isInteger(p.arrival) || p.arrival < 0 || p.arrival > 1000 || !Number.isInteger(p.burst) || p.burst < 1 || p.burst > 1000 || !Number.isInteger(p.priority)) || processes.reduce((sum, p) => sum + p.burst, 0) > 2000) {
        throw new Error("Use 1–20 processes, arrival 0–1000, burst 1–1000, and a total burst no greater than 2000.");
      }
      if (new Set(processes.map((p) => p.id)).size !== processes.length) throw new Error("Process IDs must be unique.");
      if (cpuAlgorithm === "Round Robin" && (!Number.isInteger(quantum) || quantum < 1)) throw new Error("Time quantum must be a positive whole number.");
      const result = simulateCpu(cpuAlgorithm, processes, quantum);
      setCpuResult(result);
      setRuns((prev) => [{ category: "CPU", algorithm: cpuAlgorithm, metric: "Avg. waiting", value: result.averageWaiting, time: timeLabel() }, ...prev].slice(0, 20));
      notify(`${cpuAlgorithm} simulation complete`);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not run simulation.", true); }
  };
  const runPages = () => {
    try {
      const parsed = references.split(/[,\s]+/).filter(Boolean).map(Number);
      if (!parsed.length || parsed.length > 200 || parsed.some((p) => !Number.isInteger(p) || p < 0)) throw new Error("Enter 1–200 non-negative whole-number page IDs, separated by commas.");
      const result = simulatePages(pageAlgorithm, parsed, frameCount);
      setPageResult(result); setPageStep(0); setIsPlaying(false);
      setRuns((prev) => [{ category: "Memory", algorithm: pageAlgorithm, metric: "Page faults", value: result.faults, time: timeLabel() }, ...prev].slice(0, 20));
      notify(`${pageAlgorithm} page trace ready`);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not run simulation.", true); }
  };
  const runDisk = () => {
    try {
      const parsed = requests.split(/[,\s]+/).filter(Boolean).map(Number);
      if (!parsed.length || parsed.length > 100 || parsed.some((n) => !Number.isInteger(n))) throw new Error("Enter 1–100 whole-number cylinder requests separated by commas.");
      const result = simulateDisk(diskAlgorithm, parsed, head, diskSize, direction);
      setDiskResult(result);
      setRuns((prev) => [{ category: "Disk", algorithm: diskAlgorithm, metric: "Head movement", value: result.totalMovement, time: timeLabel() }, ...prev].slice(0, 20));
      notify(`${diskAlgorithm} disk simulation complete`);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not run simulation.", true); }
  };
  const runTerminal = () => {
    const raw = terminalInput.trim();
    if (!raw) return;
    const args = raw.split(/\s+/);
    const command = args[0].toLowerCase();
    const responses: Record<string, string> = {
      help: "Available: help, clear, date, uname, whoami, pwd, ls, lscpu, free, ps, history, echo <text>, cat /proc/cpuinfo",
      date: new Date().toString(),
      uname: "Linux kernelscope 6.8.0-virtual #1 SMP x86_64 GNU/Linux",
      whoami: "student",
      pwd: "/home/student/kernelscope",
      ls: "algorithms/  simulations/  README.md  system.log",
      lscpu: "Architecture: x86_64\nCPU(s): 4\nModel name: Virtual Core™\nVirtualization: enabled",
      free: "               total        used        free\nMem:          8192Mi      2840Mi      5352Mi\nSwap:         2048Mi         0Mi      2048Mi",
      ps: " PID  TTY          TIME CMD\n  1   pts/0    00:00:02 kernelscope\n 42   pts/0    00:00:00 bash",
      "cat /proc/cpuinfo": "processor : 0\nvendor_id : KernelScope Virtual CPU\ncpu cores : 4\nflags : fpu sse sse2 avx"
    };
    const response = command === "clear" ? "" : command === "history" ? terminalHistory.join("\n") || "No previous commands." :
      command === "echo" ? args.slice(1).join(" ") : responses[raw] ?? responses[command] ?? `bash: ${args[0]}: command not found (safe educational shell)`;
    if (command === "clear") setTerminalLines([]);
    else setTerminalLines((prev) => [...prev, `student@kernelscope:~$ ${raw}`, ...response.split("\n"), ""]);
    setTerminalHistory((prev) => [...prev, raw]);
    setTerminalCursor(-1);
    setTerminalInput("");
  };

  const exportHistory = () => {
    if (!runs.length) { notify("Run a simulation before exporting results."); return; }
    csvDownload("kernelscope-simulation-history.csv", [["Category", "Algorithm", "Metric", "Value", "Time"], ...runs.map((r) => [r.category, r.algorithm, r.metric, format(r.value, 2), r.time])]);
    notify("CSV exported successfully");
  };

  const title = view === "Dashboard" ? "Control room" : view;
  const subtitle = view === "Dashboard" ? "Your operating systems lab, at a glance." : pageDescription(view);
  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"} ${mobileMenu ? "sidebar-mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          {sidebarOpen && <div className="brand-copy"><strong>kernel<span>scope</span></strong><small>SIMULATION LAB <i>•</i> LITE</small></div>}
          <button className="sidebar-toggle" aria-label="Collapse sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}><ChevronLeft size={15} /></button>
        </div>
        <div className="workspace-switch"><div className="workspace-icon"><Server size={15} /></div>{sidebarOpen && <><div><strong>OS Lab workspace</strong><small>Virtual environment</small></div><ChevronDown size={14} className="muted" /></>}</div>
        <nav className="side-nav">
          {["Workspace", "Simulators", "Insights", "System"].map((group) => (
            <div className="nav-group" key={group}>
              {sidebarOpen && <div className="nav-label">{group}</div>}
              {navItems.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
                <button key={label} title={!sidebarOpen ? label : undefined} onClick={() => switchView(label)} className={`nav-item ${view === label ? "active" : ""}`}>
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Linux Terminal" && sidebarOpen && <span className="nav-live-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {sidebarOpen && <div className="vm-card"><div className="vm-card-top"><span className="status-dot" /> VM STATUS <span className="vm-running">RUNNING</span></div><div className="vm-name">kernel-lab-01</div><div className="vm-meta">Ubuntu 24.04 LTS <span>·</span> x86_64</div><div className="vm-progress"><i /></div><div className="vm-foot"><span>CPU LOAD</span><strong>24%</strong><span>MEMORY</span><strong>38%</strong></div></div>}
          <div className="profile-button"><div className="avatar">DK</div>{sidebarOpen && <><div className="profile-copy"><strong>Demo Student</strong><small>Local workspace</small></div><Settings2 size={16} className="muted" /></>}</div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={19} /></button><div className="breadcrumb"><span>KernelScope</span><ChevronRight size={14} /><strong>{view}</strong></div></div>
          <div className="topbar-actions"><div className="system-pill"><span className="status-dot" /> <span>Kernel online</span></div><button className="icon-button" title="Search pages" aria-label="Search pages" onClick={() => { setSearchQuery(""); setSearchOpen(true); }}><Search size={17} /></button><button className="icon-button help-button" title="Help" onClick={() => notify("Choose a module to start an interactive simulation.")}><CircleHelp size={17} /></button><div className="topbar-divider" /><div className="topbar-avatar">DK</div></div>
        </header>
        <div className="content-scroll">
          <AnimatePresence mode="wait">
            <motion.div key={view} className="page-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> KERNELSCOPE <span className="eyebrow-slash">/</span> {view.toUpperCase()}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-right"><div className="live-tag"><span className="status-dot" /> LIVE LAB</div><span className="heading-date">{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></div></div>
              {view === "Dashboard" && <Dashboard processes={processes} cpuChart={chartData} runs={runs} onNavigate={switchView} onExport={exportHistory} />}
              {view === "CPU Scheduling" && <CpuPage processes={processes} setProcesses={setProcesses} algorithm={cpuAlgorithm} setAlgorithm={setCpuAlgorithm} quantum={quantum} setQuantum={setQuantum} result={cpuResult} onRun={() => runWithLoading(runCpu)} loading={simulating} onReset={() => { setProcesses(sampleProcesses); setCpuResult(null); setCpuAlgorithm("SRTF"); }} />}
              {view === "Page Replacement" && <PagePage references={references} setReferences={setReferences} frameCount={frameCount} setFrameCount={setFrameCount} algorithm={pageAlgorithm} setAlgorithm={setPageAlgorithm} result={pageResult} step={pageStep} setStep={setPageStep} isPlaying={isPlaying} setIsPlaying={setIsPlaying} onRun={() => runWithLoading(runPages)} loading={simulating} />}
              {view === "Disk Scheduling" && <DiskPage requests={requests} setRequests={setRequests} head={head} setHead={setHead} diskSize={diskSize} setDiskSize={setDiskSize} direction={direction} setDirection={setDirection} algorithm={diskAlgorithm} setAlgorithm={setDiskAlgorithm} result={diskResult} onRun={() => runWithLoading(runDisk)} loading={simulating} />}
              {view === "Algorithm Comparison" && <ComparisonPage cpuChart={chartData} processes={processes} references={pageReferenceNumbers} frameCount={frameCount} requests={diskRequestNumbers} head={head} diskSize={diskSize} direction={direction} />}
              {view === "Performance Analytics" && <AnalyticsPage runs={runs} cpuChart={chartData} onExport={exportHistory} />}
              {view === "Linux Terminal" && <TerminalPage lines={terminalLines} input={terminalInput} setInput={setTerminalInput} onRun={runTerminal} history={terminalHistory} cursor={terminalCursor} setCursor={setTerminalCursor} />}
              {view === "About Project" && <AboutPage onNavigate={switchView} />}
              <footer className="page-footer"><span>© {new Date().getFullYear()} KernelScope Lite</span><span><span className="status-dot" /> All systems operational</span><span>Built for curious minds <span className="footer-heart">✦</span></span></footer>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <AnimatePresence>{searchOpen && <motion.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}><motion.div className="search-dialog" initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5 }} role="dialog" aria-modal="true" aria-label="Navigate to a page"><div className="search-entry"><Search size={17} /><input autoFocus placeholder="Search pages and simulators..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setSearchOpen(false); if (e.key === "Enter") { const match = navItems.find((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase())); if (match) { switchView(match.label); setSearchOpen(false); } } }} /><kbd>ESC</kbd><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={15} /></button></div><div className="search-results">{navItems.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase())).map(({ label, icon: Icon, group }) => <button key={label} onClick={() => { switchView(label); setSearchOpen(false); }}><Icon size={16} /><span>{label}</span><small>{group}</small><ArrowRight size={13} /></button>)}{!navItems.some((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase())) && <div className="search-no-results">No matching pages. Try “CPU” or “terminal”.</div>}</div><div className="search-hint"><span>QUICK NAVIGATION</span><span>Choose a destination</span></div></motion.div></motion.div>}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div className={`toast ${toast.error ? "toast-error" : ""}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>{toast.error ? <CircleAlert size={16} /> : <Check size={16} />}{toast.message}</motion.div>}</AnimatePresence>
    </div>
  );
}

function pageDescription(view: View) {
  const descriptions: Record<View, string> = {
    Dashboard: "Your operating systems lab, at a glance.",
    "CPU Scheduling": "Visualize how the processor shares time between competing processes.",
    "Page Replacement": "Trace memory frames as virtual pages move through the cache.",
    "Disk Scheduling": "Explore how the disk head navigates a queue of cylinder requests.",
    "Algorithm Comparison": "Compare strategies side by side using consistent input data.",
    "Performance Analytics": "Turn every simulation into a clear performance story.",
    "Linux Terminal": "A safe, simulated Linux shell for exploring your virtual system.",
    "About Project": "A compact, interactive lab for operating systems concepts."
  };
  return descriptions[view];
}

function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{detail && <span>{detail}</span>}</div>{action}</div>;
}
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function Dashboard({ processes, cpuChart, runs, onNavigate, onExport }: {
  processes: ProcessInput[]; cpuChart: CpuChartPoint[]; runs: RunRecord[];
  onNavigate: (view: View) => void; onExport: () => void
}) {
  const modules = [
    { title: "CPU Scheduling" as View, icon: Cpu, code: "01 / PROCESS", desc: "Explore how the scheduler balances throughput, fairness and response time.", color: "blue", stat: "5 algorithms", tag: "PROCESSOR" },
    { title: "Page Replacement" as View, icon: Database, code: "02 / MEMORY", desc: "Watch virtual pages compete for a limited number of physical frames.", color: "violet", stat: "3 algorithms", tag: "MEMORY" },
    { title: "Disk Scheduling" as View, icon: HardDrive, code: "03 / STORAGE", desc: "Follow the disk head as it optimizes a changing queue of requests.", color: "amber", stat: "6 algorithms", tag: "STORAGE" }
  ];
  return <>
    <section className="hero-panel">
      <div className="hero-copy"><div className="hero-kicker"><Zap size={13} /> YOUR OPERATING SYSTEMS PLAYGROUND</div><h2>Welcome to<br /><span>KernelScope Lite</span></h2><p className="hero-subtitle">Simulation and Comparative Analysis of CPU Scheduling, Page Replacement, and Disk Scheduling in a Linux Virtual Machine.</p><div className="hero-tagline">Understand. Simulate. Analyze. Optimize.</div><div className="hero-buttons"><button className="button-primary" onClick={() => onNavigate("CPU Scheduling")}><Play size={15} fill="currentColor" /> Start a simulation</button><button className="button-quiet" onClick={() => onNavigate("About Project")}>Explore the lab <ArrowRight size={15} /></button></div><div className="hero-footnote"><span><span className="tiny-dot" /> Interactive algorithm visualizations</span><span>Built for learning, not just output</span></div></div>
      <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-orbit orbit-three" /><div className="hero-core"><div className="core-glow" /><Cpu size={38} strokeWidth={1.2} /><span>KERNEL<br />CORE</span></div><div className="float-chip chip-a"><span className="chip-indicator" />CPU <b>0x04</b></div><div className="float-chip chip-b"><Layers3 size={12} /> MEM <b>3 FR</b></div><div className="float-chip chip-c"><HardDrive size={12} /> I/O <b>READY</b></div><span className="art-coordinate">KS—01<br />VIRTUAL INSTANCE</span></div>
    </section>
    <div className="stats-grid">
      <StatCard label="Total algorithms" value="14" icon={Layers3} note="Across 3 core modules" accent="cyan" />
      <StatCard label="Simulations run" value={String(runs.length).padStart(2, "0")} icon={Activity} note="This session" accent="violet" />
      <StatCard label="Avg. waiting time" value={runs.find((r) => r.category === "CPU") ? `${format(runs.find((r) => r.category === "CPU")!.value)} units` : "—"} icon={Clock3} note="Latest CPU simulation" accent="amber" />
      <StatCard label="Total page faults" value={runs.find((r) => r.category === "Memory") ? String(runs.find((r) => r.category === "Memory")!.value) : "—"} icon={Layers3} note="Latest memory trace" accent="rose" />
    </div>
    <SectionTitle title="Simulation modules" detail="Pick a system to inspect" action={<button className="text-link" onClick={() => onNavigate("Algorithm Comparison")}>Compare algorithms <ArrowRight size={14} /></button>} />
    <div className="module-grid">{modules.map(({ title, icon: Icon, code, desc, color, stat, tag }, i) => <motion.button key={title} className={`module-card module-${color}`} onClick={() => onNavigate(title)} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}><div className="module-top"><span>{code}</span><span className="module-tag">{tag}</span></div><div className="module-icon"><Icon size={21} /></div><h3>{title}</h3><p>{desc}</p><div className="module-bottom"><span>{stat}</span><span className="module-cta">Explore <ArrowUpRight size={15} /></span></div><div className="module-glow" /></motion.button>)}</div>
    <div className="dashboard-lower">
      <Panel className="chart-panel"><SectionTitle title="Scheduler profile" detail="Average time · current process set" action={<button className="mini-select" onClick={() => onNavigate("Algorithm Comparison")}>CPU <ChevronDown size={13} /></button>} /><ChartFrame><ResponsiveContainer width="100%" height="100%"><BarChart data={cpuChart} margin={{ top: 10, right: 4, bottom: 0, left: -18 }} barGap={5}><CartesianGrid stroke="#202637" vertical={false} /><XAxis dataKey="algorithm" tick={{ fill: "#8290a7", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#6f7a90", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="Avg. waiting" fill="#58d4ff" radius={[4, 4, 0, 0]} /><Bar dataKey="Avg. turnaround" fill="#9480ff" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartFrame><div className="chart-legend"><span><i className="legend-cyan" /> Avg. waiting</span><span><i className="legend-violet" /> Avg. turnaround</span><span className="chart-note">Based on {processes.length} processes</span></div></Panel>
      <Panel className="activity-panel"><SectionTitle title="Recent activity" detail="Your latest lab runs" action={<button className="icon-button small" title="Export CSV" onClick={onExport}><Download size={15} /></button>} /><div className="activity-list">{runs.length ? runs.slice(0, 5).map((run, i) => <div className="activity-row" key={`${run.time}-${run.algorithm}-${i}`}><div className={`activity-icon activity-${run.category.toLowerCase()}`}>{run.category === "CPU" ? <Cpu size={14} /> : run.category === "Disk" ? <HardDrive size={14} /> : <Layers3 size={14} />}</div><div className="activity-description"><strong>{run.algorithm} <span>{run.category}</span></strong><small>{run.metric} · {format(run.value, 2)}</small></div><time>{run.time}</time></div>) : <div className="empty-activity"><div className="empty-icon"><History size={17} /></div><strong>Your lab is ready</strong><span>Run a simulation to see it appear here.</span><button onClick={() => onNavigate("CPU Scheduling")}>Run first simulation <ArrowRight size={13} /></button></div>}</div><div className="activity-footer"><span><span className="status-dot" /> LOCAL SESSION</span><button onClick={() => onNavigate("Performance Analytics")}>View analytics <ArrowRight size={13} /></button></div></Panel>
    </div>
    <div className="quick-strip"><div className="quick-label"><Zap size={15} /><strong>Quick launch</strong><span>Jump straight in</span></div><button onClick={() => onNavigate("CPU Scheduling")}><Cpu size={15} /> CPU sandbox <ArrowRight size={13} /></button><button onClick={() => onNavigate("Page Replacement")}><Layers3 size={15} /> Memory trace <ArrowRight size={13} /></button><button onClick={() => onNavigate("Disk Scheduling")}><HardDrive size={15} /> Disk queue <ArrowRight size={13} /></button></div>
  </>;
}
function StatCard({ label, value, icon: Icon, note, accent }: { label: string; value: string; icon: typeof Cpu; note: string; accent: string }) {
  return <div className={`stat-card stat-${accent}`}><div className="stat-top"><span>{label}</span><Icon size={16} /></div><strong>{value}</strong><small>{note}</small><div className="stat-accent" /></div>;
}
function ChartFrame({ children }: { children: React.ReactNode }) { return <div className="chart-frame">{children}</div>; }
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((p: any) => <span key={p.name}><i style={{ background: p.color }} />{p.name}: {p.value}</span>)}</div>;
}
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}{hint && <em title={hint}>ⓘ</em>}</span>{children}</label>;
}
function Select({ value, onChange, options }: { value: string; onChange: (value: any) => void; options: string[] }) {
  return <div className="select-wrap"><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></div>;
}
function RunButton({ onClick, label = "Run simulation", loading = false }: { onClick: () => void; label?: string; loading?: boolean }) {
  return <button className="button-primary run-button" onClick={onClick} disabled={loading}>{loading ? <LoaderCircle className="loading-icon" size={14} /> : <Play size={14} fill="currentColor" />}{loading ? "Simulating..." : label}</button>;
}
function Metric({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: string }) {
  return <div className={`metric ${accent ?? ""}`}><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div>;
}
function CpuPage({ processes, setProcesses, algorithm, setAlgorithm, quantum, setQuantum, result, onRun, onReset, loading }: {
  processes: ProcessInput[]; setProcesses: (p: ProcessInput[]) => void; algorithm: CpuAlgorithm; setAlgorithm: (a: CpuAlgorithm) => void;
  quantum: number; setQuantum: (q: number) => void; result: ScheduleResult | null; onRun: () => void; onReset: () => void; loading: boolean;
}) {
  const update = (index: number, key: keyof ProcessInput, value: string) => setProcesses(processes.map((p, i) => i === index ? { ...p, [key]: key === "id" ? value : value === "" ? 0 : Number(value) } : p));
  return <div className="tool-grid">
    <Panel className="control-panel"><SectionTitle title="Configure scheduler" detail="Define the workload" /><div className="form-grid"><Field label="Scheduling algorithm"><Select value={algorithm} onChange={setAlgorithm} options={cpuAlgorithms} /></Field><Field label="Time quantum" hint="Time slice used by Round Robin."><input type="number" min="1" value={quantum} onChange={(e) => setQuantum(Number(e.target.value))} disabled={algorithm !== "Round Robin"} /></Field></div><div className="table-heading"><strong>Process table</strong><span>{processes.length} processes</span></div><div className="table-scroll"><table className="data-table process-table"><thead><tr><th>PROCESS</th><th>ARRIVAL</th><th>BURST</th><th>PRIORITY</th><th /></tr></thead><tbody>{processes.map((p, i) => <tr key={`${i}-${p.id}`}><td><input aria-label="Process ID" className="process-id" value={p.id} onChange={(e) => update(i, "id", e.target.value)} /></td><td><input aria-label="Arrival time" type="number" min="0" value={p.arrival} onChange={(e) => update(i, "arrival", e.target.value)} /></td><td><input aria-label="Burst time" type="number" min="1" value={p.burst} onChange={(e) => update(i, "burst", e.target.value)} /></td><td><input aria-label="Priority" type="number" value={p.priority} onChange={(e) => update(i, "priority", e.target.value)} /></td><td><button className="remove-row" title="Remove process" disabled={processes.length <= 1} onClick={() => setProcesses(processes.filter((_, n) => n !== i))}><X size={14} /></button></td></tr>)}</tbody></table></div><div className="form-actions"><button className="button-secondary" onClick={() => setProcesses([...processes, { id: `P${processes.length + 1}`, arrival: 0, burst: 3, priority: 1 }])}>+ Add process</button><button className="button-quiet compact" onClick={onReset}><RotateCcw size={14} /> Reset</button><RunButton onClick={onRun} loading={loading} /></div><div className="note-line"><CircleHelp size={13} /> For Priority scheduling, the smaller number means higher priority.</div></Panel>
    <Panel className="results-panel"><SectionTitle title="Execution timeline" detail={result ? `${result.algorithm} · ${result.segments[result.segments.length - 1]?.end ?? 0} time units` : "Run a simulation to generate the schedule"} /><div className="gantt-wrap">{result ? <><div className="gantt-blocks">{result.segments.map((seg, i) => <div className={`gantt-block ${seg.id === "Idle" ? "gantt-idle" : ""}`} key={`${seg.id}-${i}`} style={{ flex: Math.max(seg.end - seg.start, 1), background: seg.id === "Idle" ? undefined : palette[Math.max(0, (Number(seg.id.replace(/\D/g, "")) - 1) % palette.length)] }}><strong>{seg.id}</strong></div>)}</div><div className="gantt-ticks">{result.segments.map((seg, i) => <span key={i} style={{ left: `${((seg.start - result.segments[0].start) / Math.max(1, result.segments[result.segments.length - 1].end - result.segments[0].start)) * 100}%` }}>{seg.start}</span>)}<span className="last-tick">{result.segments[result.segments.length - 1]?.end}</span></div></> : <div className="empty-chart"><div className="empty-icon"><Activity size={19} /></div><strong>No timeline yet</strong><span>Configure your workload, then run it.</span></div>}</div>{result && <div className="metric-row"><Metric label="AVG. WAITING" value={format(result.averageWaiting)} suffix=" units" accent="metric-cyan" /><Metric label="AVG. TURNAROUND" value={format(result.averageTurnaround)} suffix=" units" accent="metric-violet" /><Metric label="PROCESSES" value={String(result.processes.length).padStart(2, "0")} suffix=" total" /></div>}<div className="table-heading results-table-heading"><strong>Process metrics</strong><span>Time units</span></div>{result ? <div className="table-scroll"><table className="data-table results-table"><thead><tr><th>PROCESS</th><th>CT</th><th>TAT</th><th>WAIT</th><th>RESPONSE</th></tr></thead><tbody>{result.processes.map((p) => <tr key={p.id}><td><span className="process-color" style={{ background: palette[Math.max(0, (Number(p.id.replace(/\D/g, "")) - 1) % palette.length)] }} />{p.id}</td><td>{p.completion}</td><td>{p.turnaround}</td><td>{p.waiting}</td><td>{p.response}</td></tr>)}</tbody></table></div> : <div className="table-placeholder">Completion, turnaround, waiting and response times appear here.</div>}</Panel>
    <Panel className="full-panel"><SectionTitle title="How this scheduler works" detail="The basics, without the textbook fog" /><div className="concept-grid"><Concept title="Arrival time" text="When a process enters the ready queue and becomes eligible for CPU time." /><Concept title="Burst time" text="The total CPU time a process needs to complete its work." /><Concept title="Waiting time" text="Time spent in the ready queue, calculated as turnaround minus burst." /><Concept title="Response time" text="Time from arrival until a process first receives the CPU." /></div></Panel>
  </div>;
}
function Concept({ title, text }: { title: string; text: string }) { return <div className="concept"><span className="concept-mark" /><strong>{title}</strong><p>{text}</p></div>; }
function PagePage({ references, setReferences, frameCount, setFrameCount, algorithm, setAlgorithm, result, step, setStep, isPlaying, setIsPlaying, onRun, loading }: {
  references: string; setReferences: (s: string) => void; frameCount: number; setFrameCount: (n: number) => void; algorithm: PageAlgorithm; setAlgorithm: (a: PageAlgorithm) => void;
  result: PageResult | null; step: number; setStep: (n: number) => void; isPlaying: boolean; setIsPlaying: (v: boolean) => void; onRun: () => void; loading: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const visibleStep = result?.steps[Math.min(step, Math.max(0, result.steps.length - 1))];
  const stepNext = () => setStep(Math.min(step + 1, (result?.steps.length ?? 1) - 1));
  const traceCsv = () => {
    if (!result) return;
    csvDownload("kernelscope-page-trace.csv", [["Step", "Page", ...result.steps[0].frames.map((_, i) => `Frame ${i + 1}`), "Result"], ...result.steps.map((s, i) => [i + 1, s.page, ...s.frames.map((f) => f ?? "—"), s.hit ? "Hit" : "Fault"])]);
    setCopied(true); window.setTimeout(() => setCopied(false), 2000);
  };
  return <div className="tool-grid">
    <Panel className="control-panel"><SectionTitle title="Configure memory" detail="Set up your reference trace" /><Field label="Page reference string" hint="Comma- or space-separated page numbers."><textarea className="reference-input" value={references} onChange={(e) => setReferences(e.target.value)} rows={3} /></Field><div className="form-grid"><Field label="Replacement algorithm"><Select value={algorithm} onChange={setAlgorithm} options={pageAlgorithms} /></Field><Field label="Number of frames"><input type="number" min="1" max="12" value={frameCount} onChange={(e) => setFrameCount(Number(e.target.value))} /></Field></div><div className="info-callout"><span className="callout-symbol">i</span><p><strong>{algorithm}</strong> {algorithm === "FIFO" ? "evicts the page that has been in memory longest." : algorithm === "LRU" ? "evicts the page that was least recently accessed." : "evicts the page whose next use is farthest away."}</p></div><div className="form-actions"><button className="button-secondary" onClick={() => setReferences(defaultReferences.join(", "))}><RotateCcw size={14} /> Sample trace</button><RunButton onClick={onRun} label="Generate trace" loading={loading} /></div></Panel>
    <Panel className="results-panel"><div className="section-title"><div><h2>Memory trace</h2><span>{result ? `${result.steps.length} references · step ${Math.min(step + 1, result.steps.length)} of ${result.steps.length}` : "Page flow through physical frames"}</span></div>{result && <button className="icon-button small" title="Export trace as CSV" onClick={traceCsv}>{copied ? <Check size={15} /> : <Download size={15} />}</button>}</div>
      {result ? <><div className="trace-display"><div className="trace-current"><span className="trace-label">CURRENT PAGE</span><strong>{visibleStep?.page ?? "—"}</strong><span className={`trace-state ${visibleStep?.hit ? "hit" : "fault"}`}>{visibleStep?.hit ? "PAGE HIT" : "PAGE FAULT"}</span></div><div className="frame-stack">{visibleStep?.frames.map((frame, i) => <motion.div layout key={`frame-${i}`} className={`frame-cell ${frame === visibleStep.page && !visibleStep.hit ? "frame-new" : ""} ${frame === visibleStep.page && visibleStep.hit ? "frame-hit" : ""}`}><span>FRAME {String(i + 1).padStart(2, "0")}</span><AnimatePresence mode="wait"><motion.strong key={`${frame}-${step}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>{frame ?? "—"}</motion.strong></AnimatePresence></motion.div>)}</div></div><div className="trace-progress"><div className="trace-progress-fill" style={{ width: `${((step + 1) / result.steps.length) * 100}%` }} /></div><div className="trace-controls"><span>REFERENCE <b>{String(step + 1).padStart(2, "0")}</b><span className="slash">/</span>{String(result.steps.length).padStart(2, "0")}</span><div><button title="Reset" onClick={() => { setStep(0); setIsPlaying(false); }}><RotateCcw size={14} /></button><button title="Previous" disabled={step <= 0} onClick={() => setStep(Math.max(0, step - 1))}><ChevronLeft size={16} /></button><button className="trace-play" title={isPlaying ? "Pause" : "Play"} onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <span className="pause-icon">Ⅱ</span> : <Play size={13} fill="currentColor" />}</button><button title="Next" disabled={step >= result.steps.length - 1} onClick={stepNext}><ChevronRight size={16} /></button></div></div><div className="reference-strip">{result.steps.map((s, i) => <button key={i} className={`reference-chip ${s.hit ? "chip-hit" : "chip-fault"} ${step === i ? "chip-current" : ""}`} title={`Step ${i + 1}: ${s.hit ? "Hit" : "Fault"}`} onClick={() => setStep(i)}>{s.page}</button>)}</div><div className="metric-row"><Metric label="PAGE HITS" value={String(result.hits)} accent="metric-green" /><Metric label="PAGE FAULTS" value={String(result.faults)} accent="metric-rose" /><Metric label="HIT RATIO" value={`${format(result.hitRatio * 100)}%`} accent="metric-cyan" /><Metric label="FAULT RATIO" value={`${format(result.faultRatio * 100)}%`} accent="metric-amber" /></div></> : <div className="page-empty"><div className="frame-empty-icon"><Layers3 size={25} /></div><strong>Memory, visualized.</strong><p>Run a trace to watch page hits and faults unfold one reference at a time.</p><div className="empty-frame-preview"><span>FRAME 01 <b>—</b></span><span>FRAME 02 <b>—</b></span><span>FRAME 03 <b>—</b></span></div></div>}
    </Panel>
    <Panel className="full-panel"><SectionTitle title="Replacement strategies" detail="What changes between algorithms?" /><div className="strategy-grid">{pageAlgorithms.map((item, i) => <div className={`strategy-card ${item === algorithm ? "selected" : ""}`} key={item}><span className="strategy-index">0{i + 1}</span><strong>{item}</strong><p>{["Replace the oldest loaded page. Simple, but it can evict a frequently used page.", "Replace the page that has stayed untouched for the longest time.", "Use future knowledge to replace the page needed furthest in the future."][i]}</p><span className="strategy-badge">{["QUEUE BASED", "RECENCY BASED", "IDEAL BENCHMARK"][i]}</span></div>)}</div></Panel>
  </div>;
}

function DiskPage({ requests, setRequests, head, setHead, diskSize, setDiskSize, direction, setDirection, algorithm, setAlgorithm, result, onRun, loading }: {
  requests: string; setRequests: (s: string) => void; head: number; setHead: (n: number) => void; diskSize: number; setDiskSize: (n: number) => void;
  direction: DiskDirection; setDirection: (d: DiskDirection) => void; algorithm: DiskAlgorithm; setAlgorithm: (a: DiskAlgorithm) => void;
  result: DiskResult | null; onRun: () => void; loading: boolean;
}) {
  const positions = result ? [head, ...result.sequence] : [head, ...defaultRequests];
  const chartWidth = 720;
  const leftPad = 26;
  const x = (n: number) => leftPad + (n / Math.max(1, diskSize - 1)) * (chartWidth - leftPad * 2);
  const polyline = positions.map((position, i) => `${x(position)},${34 + i * 31}`).join(" ");
  return <div className="tool-grid">
    <Panel className="control-panel"><SectionTitle title="Configure disk" detail="Shape the request queue" /><Field label="Request queue" hint="Cylinder positions, separated by commas or spaces."><textarea className="reference-input" value={requests} onChange={(e) => setRequests(e.target.value)} rows={3} /></Field><div className="form-grid"><Field label="Scheduling algorithm"><Select value={algorithm} onChange={setAlgorithm} options={diskAlgorithms} /></Field><Field label="Initial direction"><Select value={direction} onChange={setDirection} options={["right", "left"]} /></Field><Field label="Initial head position"><input type="number" min="0" max={diskSize - 1} value={head} onChange={(e) => setHead(Number(e.target.value))} /></Field><Field label="Disk size (cylinders)"><input type="number" min="2" value={diskSize} onChange={(e) => setDiskSize(Number(e.target.value))} /></Field></div><div className="info-callout"><span className="callout-symbol">i</span><p><strong>{algorithm}</strong> {algorithm === "FCFS" ? "serves requests in arrival order." : algorithm === "SSTF" ? "moves next to the closest pending cylinder." : algorithm.includes("C-") ? "moves in one direction, then wraps to the opposite end." : `${algorithm} moves toward the ${direction} edge before reversing or turning around.`}</p></div><div className="form-actions"><button className="button-secondary" onClick={() => { setRequests(defaultRequests.join(", ")); setHead(53); setDiskSize(200); setDirection("right"); }}><RotateCcw size={14} /> Sample queue</button><RunButton onClick={onRun} loading={loading} /></div><div className="note-line"><CircleHelp size={13} /> Cylinder range: 0 to {Math.max(0, diskSize - 1)}. Disk size and requests must be valid.</div></Panel>
    <Panel className="results-panel disk-results"><SectionTitle title="Head movement" detail={result ? `${result.sequence.length} requests serviced` : "Position plotted against service order"} /><div className="disk-chart-scroll"><div className="disk-chart"><svg viewBox={`0 0 ${chartWidth} ${Math.max(110, positions.length * 31 + 18)}`} preserveAspectRatio="none" role="img" aria-label="Disk head movement visualization"><defs><linearGradient id="diskLine" x1="0" x2="1"><stop offset="0%" stopColor="#9b82ff" /><stop offset="100%" stopColor="#52d8ff" /></linearGradient></defs><line x1={leftPad} x2={chartWidth - leftPad} y1="13" y2="13" stroke="#293447" strokeDasharray="3 5" />{Array.from({ length: 5 }, (_, i) => { const val = Math.round(((diskSize - 1) / 4) * i); return <g key={i}><line x1={x(val)} x2={x(val)} y1="13" y2={Math.max(110, positions.length * 31 + 18)} stroke="#1b2535" /><text x={x(val)} y="9" textAnchor="middle" fill="#728098" fontSize="9">{val}</text></g>; })}<polyline points={polyline} fill="none" stroke="url(#diskLine)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />{positions.map((position, i) => <g key={`${position}-${i}`}><circle cx={x(position)} cy={34 + i * 31} r={i === 0 ? 5 : 4} fill={i === 0 ? "#f8b952" : "#62d6fa"} stroke="#0c1220" strokeWidth="2" /><text x={x(position)} y={29 + i * 31} textAnchor="middle" fill={i === 0 ? "#f7c66c" : "#c6d5e8"} fontSize="9">{position}</text><text x="0" y={38 + i * 31} fill="#65738a" fontSize="8">{i === 0 ? "HEAD" : `#${i}`}</text></g>)}</svg></div></div>{result ? <><div className="disk-sequence"><span className="trace-label">SERVICE ORDER</span><div className="sequence-chips"><span className="head-chip">{head}</span>{result.sequence.map((position, i) => <span className="sequence-unit" key={`${position}-${i}`}><ArrowRight size={11} />{position}</span>)}</div></div><div className="metric-row"><Metric label="TOTAL MOVEMENT" value={String(result.totalMovement)} suffix=" cylinders" accent="metric-cyan" /><Metric label="AVG. MOVEMENT" value={format(result.averageMovement)} suffix=" / request" accent="metric-violet" /><Metric label="REQUESTS" value={String(result.sequence.length).padStart(2, "0")} suffix=" served" /></div></> : <div className="disk-empty-note">Run the queue to calculate total and average head movement.</div>}</Panel>
    <Panel className="full-panel"><SectionTitle title="Movement, made visible" detail="Each plotted point is a head position in service order" /><div className="disk-legend"><span><i className="legend-amber" /> Initial head <b>{head}</b></span><span><i className="legend-cyan" /> Request positions</span><span className="disk-rule">Total movement = Σ |next cylinder − current cylinder|</span></div></Panel>
  </div>;
}

function ComparisonPage({ cpuChart, processes, references, frameCount, requests, head, diskSize, direction }: {
  cpuChart: CpuChartPoint[]; processes: ProcessInput[]; references: number[]; frameCount: number; requests: number[]; head: number; diskSize: number; direction: DiskDirection;
}) {
  const pageCompare = references.length && references.length <= 200 && references.every((page) => Number.isInteger(page) && page >= 0) && Number.isInteger(frameCount) && frameCount >= 1 && frameCount <= 12
    ? pageAlgorithms.map((algorithm) => ({ algorithm, ...simulatePages(algorithm, references, frameCount) })) : [];
  const diskCompare = requests.length && requests.length <= 100 && requests.every((request) => Number.isInteger(request)) && Number.isInteger(diskSize) && diskSize >= 2 && Number.isInteger(head) && head >= 0 && head < diskSize && requests.every((request) => request >= 0 && request < diskSize)
    ? diskAlgorithms.map((algorithm) => ({ algorithm, ...simulateDisk(algorithm, requests, head, diskSize, direction) })) : [];
  const bestCpu = [...cpuChart].sort((a, b) => a["Avg. waiting"] - b["Avg. waiting"])[0];
  const bestPage = [...pageCompare].sort((a, b) => a.faults - b.faults)[0];
  const bestDisk = [...diskCompare].sort((a, b) => a.totalMovement - b.totalMovement)[0];
  return <><div className="comparison-callout"><div className="callout-icon"><BarChart3 size={18} /></div><div><strong>One workload. Different strategies.</strong><p>Every result below is calculated from the current inputs in each simulator. Change a workload there and this comparison updates with it.</p></div><div className="comparison-context"><span>CPU · {processes.length} processes</span><span>MEMORY · {references.length} references</span><span>DISK · {requests.length} requests</span></div></div>
    <div className="winner-grid"><Winner category="CPU / LOWEST AVG. WAIT" value={bestCpu?.algorithm ?? "—"} detail={bestCpu ? `${format(bestCpu["Avg. waiting"])} time units` : "Check CPU inputs"} icon={Cpu} /><Winner category="MEMORY / FEWEST FAULTS" value={bestPage?.algorithm ?? "—"} detail={bestPage ? `${bestPage.faults} faults · ${bestPage.hits} hits` : "Check memory inputs"} icon={Layers3} /><Winner category="DISK / LEAST MOVEMENT" value={bestDisk?.algorithm ?? "—"} detail={bestDisk ? `${bestDisk.totalMovement} cylinders` : "Check disk inputs"} icon={HardDrive} /></div>
    <div className="comparison-grid"><Panel className="comparison-chart-panel"><SectionTitle title="CPU scheduler" detail="Lower is better · time units" /><ChartFrame><ResponsiveContainer width="100%" height="100%"><BarChart data={cpuChart} margin={{ top: 10, right: 3, left: -20, bottom: 0 }}><CartesianGrid stroke="#202637" vertical={false} /><XAxis dataKey="algorithm" tick={{ fill: "#8290a7", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#6f7a90", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="Avg. waiting" radius={[4, 4, 0, 0]}>{cpuChart.map((entry, i) => <Cell key={entry.algorithm} fill={entry.algorithm === bestCpu?.algorithm ? "#5cddbb" : palette[i % palette.length]} />)}</Bar></BarChart></ResponsiveContainer></ChartFrame><ComparisonTable headers={["ALGORITHM", "AVG WAIT", "AVG TAT"]} rows={cpuChart.map((r) => [r.algorithm, `${format(r["Avg. waiting"])}`, `${format(r["Avg. turnaround"])}`])} winner={bestCpu?.algorithm ?? ""} /></Panel>
    <Panel className="comparison-chart-panel"><SectionTitle title="Page replacement" detail={`Faults · ${frameCount} frames`} /><ChartFrame><ResponsiveContainer width="100%" height="100%"><BarChart data={pageCompare} margin={{ top: 10, right: 3, left: -20, bottom: 0 }}><CartesianGrid stroke="#202637" vertical={false} /><XAxis dataKey="algorithm" tick={{ fill: "#8290a7", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#6f7a90", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="faults" fill="#9d83ff" radius={[4, 4, 0, 0]}>{pageCompare.map((entry, i) => <Cell key={entry.algorithm} fill={entry.algorithm === bestPage?.algorithm ? "#5cddbb" : palette[(i + 1) % palette.length]} />)}</Bar></BarChart></ResponsiveContainer></ChartFrame><ComparisonTable headers={["ALGORITHM", "FAULTS", "HITS", "HIT RATIO"]} rows={pageCompare.map((r) => [r.algorithm, String(r.faults), String(r.hits), `${format(r.hitRatio * 100)}%`])} winner={bestPage?.algorithm ?? ""} /></Panel>
    <Panel className="comparison-chart-panel comparison-wide"><SectionTitle title="Disk scheduling" detail="Total head movement · cylinders" /><ChartFrame><ResponsiveContainer width="100%" height="100%"><BarChart data={diskCompare} margin={{ top: 10, right: 3, left: -20, bottom: 0 }}><CartesianGrid stroke="#202637" vertical={false} /><XAxis dataKey="algorithm" tick={{ fill: "#8290a7", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#6f7a90", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="totalMovement" radius={[4, 4, 0, 0]}>{diskCompare.map((entry, i) => <Cell key={entry.algorithm} fill={entry.algorithm === bestDisk?.algorithm ? "#5cddbb" : palette[(i + 2) % palette.length]} />)}</Bar></BarChart></ResponsiveContainer></ChartFrame><ComparisonTable headers={["ALGORITHM", "TOTAL MOVEMENT", "AVG / REQUEST", "SEQUENCE"]} rows={diskCompare.map((r) => [r.algorithm, `${r.totalMovement} cyl`, `${format(r.averageMovement)}`, r.sequence.join(" → ")])} winner={bestDisk?.algorithm ?? ""} /></Panel></div>
  </>;
}
function Winner({ category, value, detail, icon: Icon }: { category: string; value: string; detail: string; icon: typeof Cpu }) {
  return <div className="winner-card"><div className="winner-icon"><Icon size={16} /></div><span>{category}</span><strong>{value}</strong><small>{detail}</small><div className="winner-star">✦</div></div>;
}
function ComparisonTable({ headers, rows, winner }: { headers: string[]; rows: (string | number)[][]; winner: string }) {
  return <div className="table-scroll"><table className="data-table comparison-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className={String(row[0]) === winner ? "winner-row" : ""}>{row.map((cell, j) => <td key={j}>{j === 0 && String(cell) === winner && <span className="winner-dot" />}{cell}</td>)}</tr>)}</tbody></table></div>;
}

function AnalyticsPage({ runs, cpuChart, onExport }: { runs: RunRecord[]; cpuChart: any[]; onExport: () => void }) {
  const runChart = [...runs].slice(0, 10).reverse().map((run, i) => ({ run: `#${String(i + 1).padStart(2, "0")}`, value: Number(run.value.toFixed(2)), algorithm: run.algorithm }));
  const counts = ["CPU", "Memory", "Disk"].map((category, i) => ({ category, count: runs.filter((r) => r.category === category).length, fill: palette[i] }));
  return <><div className="analytics-toolbar"><div><span className="tiny-dot" /> LIVE SESSION DATA <span className="analytics-separator">·</span> {runs.length} TOTAL RUNS</div><button className="button-secondary" onClick={onExport}><Download size={14} /> Export CSV</button></div><div className="analytics-grid"><Panel className="analytics-chart"><SectionTitle title="Simulation history" detail="Recorded metric per run" /><ChartFrame>{runs.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={runChart} margin={{ top: 12, right: 10, bottom: 0, left: -18 }}><CartesianGrid stroke="#202637" vertical={false} /><XAxis dataKey="run" tick={{ fill: "#8290a7", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#6f7a90", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey="value" stroke="#5ad6fa" strokeWidth={2} dot={{ r: 3, fill: "#5ad6fa", strokeWidth: 0 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer> : <div className="chart-empty-message"><Activity size={21} /><strong>No session data yet</strong><span>Simulation results are recorded as you run them.</span></div>}</ChartFrame><div className="chart-legend"><span><i className="legend-cyan" /> Recorded result metric</span><span className="chart-note">Mixed units, labeled in run history</span></div></Panel><Panel className="analytics-chart"><SectionTitle title="Runs by module" detail="Activity breakdown this session" /><div className="module-analytics">{counts.map((item) => <div className="module-analytic" key={item.category}><div className="module-analytic-head"><span><i style={{ background: item.fill }} />{item.category}</span><b>{item.count}</b></div><div className="mini-track"><i style={{ width: `${runs.length ? (item.count / runs.length) * 100 : 0}%`, background: item.fill }} /></div></div>)}{!runs.length && <div className="analytics-empty">Run any simulator to populate your analytics.</div>}<div className="analytic-total"><span>SESSION TOTAL</span><strong>{String(runs.length).padStart(2, "0")} <small>runs</small></strong></div></div></Panel></div><Panel className="analytics-history"><SectionTitle title="Run log" detail="Most recent first" action={<span className="local-only-label">LOCAL ONLY</span>} />{runs.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>MODULE</th><th>ALGORITHM</th><th>MEASURED METRIC</th><th>RESULT</th><th>TIME</th></tr></thead><tbody>{runs.map((run, i) => <tr key={`${run.time}-${run.algorithm}-${i}`}><td><span className="category-pill">{run.category}</span></td><td>{run.algorithm}</td><td>{run.metric}</td><td className="result-number">{format(run.value, 2)}</td><td>{run.time}</td></tr>)}</tbody></table></div> : <div className="analytics-table-empty"><div className="empty-icon"><History size={17} /></div><strong>Nothing in the log yet</strong><span>Results from your local session will be listed here.</span></div>}</Panel><Panel className="analytics-chart"><SectionTitle title="CPU scheduler performance" detail="Current workload · average turnaround vs waiting" /><ChartFrame><ResponsiveContainer width="100%" height="100%"><BarChart data={cpuChart} margin={{ top: 10, right: 4, bottom: 0, left: -18 }}><CartesianGrid stroke="#202637" vertical={false} /><XAxis dataKey="algorithm" tick={{ fill: "#8290a7", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#6f7a90", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="Avg. waiting" fill="#5ad6fa" radius={[3, 3, 0, 0]} /><Bar dataKey="Avg. turnaround" fill="#9d83ff" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></ChartFrame></Panel></>;
}

function TerminalPage({ lines, input, setInput, onRun, history, cursor, setCursor }: {
  lines: string[]; input: string; setInput: (s: string) => void; onRun: () => void; history: string[]; cursor: number; setCursor: (n: number) => void;
}) {
  return <div className="terminal-layout"><Panel className="terminal-panel"><div className="terminal-header"><div className="terminal-dots"><i /><i /><i /></div><span><Terminal size={13} /> student@kernelscope: ~</span><span className="terminal-header-right"><span className="status-dot" /> SANDBOXED</span></div><div className="terminal-screen" onClick={(e) => { const inputEl = (e.currentTarget.querySelector(".terminal-input") as HTMLInputElement | null); inputEl?.focus(); }}><div className="terminal-output">{lines.map((line, i) => <div className={line.startsWith("student@") ? "terminal-command" : "terminal-result"} key={`${i}-${line}`}>{line || "\u00a0"}</div>)}</div><div className="terminal-prompt"><span>student@kernelscope<span className="terminal-path">:~</span>$</span><input className="terminal-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onRun(); if (e.key === "ArrowUp") { const next = Math.min(history.length - 1, cursor + 1); setCursor(next); setInput(history[history.length - 1 - next] ?? ""); } if (e.key === "ArrowDown") { const next = Math.max(-1, cursor - 1); setCursor(next); setInput(next < 0 ? "" : history[history.length - 1 - next] ?? ""); } }} autoFocus aria-label="Terminal command" spellCheck={false} /><span className="terminal-cursor" /></div></div><div className="terminal-foot"><span><span className="status-dot" /> Educational shell · commands are simulated locally</span><span>↑ ↓ history <kbd>ENTER</kbd> run</span></div></Panel><aside className="terminal-side"><Panel className="terminal-help"><SectionTitle title="Quick commands" detail="Try one to get started" /><div className="command-list">{[["help", "List available commands"], ["lscpu", "Inspect virtual processor"], ["free", "Check memory usage"], ["ps", "View running processes"], ["uname -a", "Kernel & system details"], ["echo hello", "Print a message"]].map(([cmd, desc]) => <button key={cmd} onClick={() => setInput(cmd)}><code>{cmd}</code><span>{desc}</span><ArrowRight size={12} /></button>)}</div></Panel><div className="safety-card"><div><Server size={15} /><strong>Safe by design</strong></div><p>This is a simulated terminal. Commands never execute on your computer, and arbitrary shell commands are not supported.</p><span><span className="status-dot" /> PROCESS ISOLATION ACTIVE</span></div></aside></div>;
}

function AboutPage({ onNavigate }: { onNavigate: (v: View) => void }) {
  return <><section className="about-hero"><div className="about-glyph"><div className="brand-mark"><span /><span /><span /><span /></div></div><div><span className="eyebrow">ABOUT THIS PROJECT</span><h2>See the system<br />beneath the surface.</h2><p>KernelScope Lite makes the invisible decisions of an operating system visible, interactive, and easier to understand.</p></div><div className="about-version"><span>VERSION</span><strong>1.0.0</strong><small>EDUCATIONAL EDITION</small></div></section><div className="about-grid"><Panel><div className="about-card-icon"><Cpu size={17} /></div><span className="eyebrow">THE PURPOSE</span><h3>Concepts into intuition</h3><p>Operating systems are full of trade-offs. KernelScope offers a safe space to experiment with scheduling, memory, and storage policies and see their measurable effects.</p></Panel><Panel><div className="about-card-icon violet"><Gauge size={17} /></div><span className="eyebrow">THE APPROACH</span><h3>Real algorithms, clear visuals</h3><p>Each simulator runs a deterministic algorithm against your inputs. Results are derived from those runs—not placeholder metrics—and remain local to your session.</p></Panel><Panel className="about-principles"><span className="eyebrow">IN THIS LAB</span><div><Check size={15} /><span>CPU: FCFS, SJF, SRTF, Priority & Round Robin</span></div><div><Check size={15} /><span>Memory: FIFO, LRU & Optimal page replacement</span></div><div><Check size={15} /><span>Disk: FCFS, SSTF, SCAN, C-SCAN, LOOK & C-LOOK</span></div><div><Check size={15} /><span>Safe simulated terminal with a curated command set</span></div></Panel><Panel className="about-cta"><div><span className="eyebrow">READY TO EXPERIMENT?</span><h3>Your next insight is one simulation away.</h3></div><button className="button-primary" onClick={() => onNavigate("CPU Scheduling")}>Open the lab <ArrowRight size={15} /></button></Panel></div></>;
}

export default App;
