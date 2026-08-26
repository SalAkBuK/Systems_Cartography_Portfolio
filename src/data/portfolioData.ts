import { 
  ProjectData, 
  InfrastructureSkill, 
  ExperienceNode, 
  ArchitecturePrinciple 
} from '../types';

export const OPERATOR_METADATA = {
  name: 'Hafsah Nasreen',
  handle: 'hafsah.sys',
  role: 'Staff Systems Engineer / Full-Stack Architect',
  location: 'San Francisco, CA // UTC-7',
  status: 'ACTIVE_BUILD // OPEN FOR HIGH-LEVERAGE OPPORTUNITIES',
  focus: 'Distributed consensus engines, high-throughput reactive UI, robust full-stack platforms',
  yearsActive: 8,
  commitsIndexed: '8,420+',
  productionUptime: '99.98%',
  primaryStack: ['TypeScript', 'Go', 'Rust', 'React', 'PostgreSQL', 'eBPF', 'Kafka'],
  systemManifesto: `I design and build software systems with high mechanical sympathy, strict failure boundaries, and minimal accidental complexity. Rather than treating code as disconnected UI screens and API endpoints, I view software as living cartography: state machines, distributed invariants, data pipelines, and ergonomic user interfaces acting as one coherent structure.`,
  contact: {
    email: 'hafsah.nasreen.dev@gmail.com',
    github: 'https://github.com/hafsah-sys',
    linkedin: 'https://linkedin.com/in/hafsah-nasreen',
    pgpKeyId: '0x8F92E31C94B2771D',
    pgpFingerprint: '94A1 8E34 B109 C321 78F0  9D3A 8F92 E31C 94B2 771D',
    matrix: '@hafsah:matrix.org',
    availability: 'Immediate (Full-time Staff/Lead or Principal Consulting)'
  }
};

export const PROJECTS: ProjectData[] = [
  {
    id: 'p01-aethermesh',
    code: 'P01',
    title: 'AetherMesh',
    tagline: 'Distributed edge consensus engine & P2P state synchronization daemon',
    category: 'infrastructure',
    status: 'PRODUCTION',
    year: '2024',
    dimensions: { width: 110, height: 85, levels: 4 },
    gridPosition: { x: -150, y: -80 },
    accentColor: '#8EA9DA', // blueprint steel
    summary: 'A zero-dependency edge consensus library written in Go with WebAssembly & WebRTC bindings. Achieves sub-8ms local-cluster state consensus with automatic split-brain partition recovery.',
    problem: 'Centralized cloud synchronization incurs high round-trip latency (120-250ms) and fails catastrophically under intermittent edge connectivity or local network partitions in field deployments.',
    solution: 'Designed a hybrid Raft + CRDT (Conflict-Free Replicated Data Type) state machine. Local nodes elect transient epoch leaders over WebRTC mesh channels, committing state locally and synchronizing vector clocks asynchronously upon partition healing.',
    architectureNotes: 'Layered architecture: Ingress WebRTC wire transport -> In-memory B-Tree vector store -> Raft consensus coordinator -> Write-Ahead Log (WAL) with snappy compression.',
    techStack: ['Go', 'WebAssembly', 'WebRTC', 'TypeScript', 'SQLite', 'Protobuf'],
    infrastructureDeps: ['infra-go', 'infra-ts', 'infra-dist', 'infra-docker'],
    subsystems: [
      {
        id: 'p01-sub-transport',
        name: 'WebRTC Mesh Ingress',
        category: 'frontend',
        role: 'P2P DataChannel multiplexer and NAT traversal',
        protocol: 'WebRTC / SCTP',
        description: 'Maintains authenticated mesh peer connections with ICE candidate pooling and heartbeat keepalives.',
        tech: ['TypeScript', 'WebRTC API', 'Protobuf'],
        coordinates: { x: -40, y: -30, z: 20 },
        dimensions: { width: 50, height: 25, depth: 35 },
        metrics: [{ label: 'NAT Traversal Rate', value: '98.4%' }, { label: 'Peer Handshake', value: '<45ms' }]
      },
      {
        id: 'p01-sub-raft',
        name: 'Raft State Machine',
        category: 'backend',
        role: 'Distributed consensus & epoch election engine',
        protocol: 'Binary RPC',
        description: 'Implements Raft consensus with log compaction, snapshot streaming, and bounded term timeouts.',
        tech: ['Go', 'WASM Core'],
        coordinates: { x: 0, y: 0, z: 50 },
        dimensions: { width: 65, height: 40, depth: 50 },
        metrics: [{ label: 'Consensus Latency', value: '6.2ms' }, { label: 'Log Throughput', value: '180k ops/sec' }]
      },
      {
        id: 'p01-sub-wal',
        name: 'WAL Storage Engine',
        category: 'database',
        role: 'Append-only persistent log and vector clock store',
        protocol: 'Direct Memory / Disk',
        description: 'Snappy-compressed write-ahead log with memory-mapped circular buffers for zero-copy read paths.',
        tech: ['Go', 'mmap', 'SQLite'],
        coordinates: { x: 45, y: 35, z: 20 },
        dimensions: { width: 55, height: 30, depth: 40 },
        metrics: [{ label: 'Disk Write Amplification', value: '1.14x' }, { label: 'Recovery Time', value: '<12ms' }]
      },
      {
        id: 'p01-sub-telemetry',
        name: 'Consensus Telemetry Agent',
        category: 'telemetry',
        role: 'Live topology graph visualizer & network latency probe',
        protocol: 'WebSocket',
        description: 'Streams live mesh health, packet drops, and partition states directly to a local diagnostic dashboard.',
        tech: ['TypeScript', 'Canvas2D'],
        coordinates: { x: -30, y: 40, z: 15 },
        dimensions: { width: 45, height: 20, depth: 30 },
        metrics: [{ label: 'Diagnostic Overhead', value: '<0.4% CPU' }]
      }
    ],
    metrics: [
      { label: 'Cluster Sync Latency', value: '6.2ms', note: 'p99 on 32-node edge cluster' },
      { label: 'Max Throughput', value: '184k ops/s', note: 'Single thread commit rate' },
      { label: 'Partition Recovery', value: '<250ms', note: 'Automatic vector clock reconciliation' },
      { label: 'Binary Footprint', value: '3.4 MB', note: 'WASM stripped artifact' }
    ],
    keyDecisions: [
      {
        decision: 'Hybrid Raft + State-based CRDTs instead of pure Paxos',
        rationale: 'Paxos requires strict majority quorums which fail during mobile field isolation; CRDT fallback allows local write availability without stalling.',
        tradeoff: 'Increased memory footprint for tombstones and vector clock headers.'
      },
      {
        decision: 'Compile Go core to WASM rather than maintaining split JS/Go codebases',
        rationale: 'Guarantees bit-identical consensus state machine logic between edge servers and browser clients.',
        tradeoff: 'Initial WASM instantiation overhead of ~18ms on cold start.'
      }
    ],
    resilienceTesting: 'ChaosMesh automated partition injection, Jepsen split-brain verification suite, and 72-hour simulated high packet loss (15% drop rate) soak testing.',
    links: {
      demo: 'https://aethermesh.dev/live-cluster',
      github: 'https://github.com/hafsah-sys/aether-mesh',
      docs: 'https://aethermesh.dev/spec',
      caseStudy: true
    }
  },
  {
    id: 'p02-pillcheck',
    code: 'P02',
    title: 'PillCheck Clinical Suite',
    tagline: 'High-assurance medication adherence & caregiver telemetry ecosystem',
    category: 'fullstack',
    status: 'PRODUCTION',
    year: '2023-2024',
    dimensions: { width: 120, height: 95, levels: 5 },
    gridPosition: { x: 30, y: -110 },
    accentColor: '#CA885C', // product terracotta
    summary: 'A fault-tolerant clinical medication platform coordinating multi-patient schedules, automated blister pack verification via on-device computer vision, and real-time caregiver escalation pipelines.',
    problem: 'Elderly patients missing critical medication windows due to convoluted schedules, while existing apps lack verified ingestion tracking, causing 28% of preventable clinical readmissions.',
    solution: 'Engineered an end-to-end telemetry system combining a zero-latency React client, offline-first mobile sync, an event-driven Node.js backend on PostgreSQL, and a Redis BullMQ worker queue with multi-tier SMS/voice escalation.',
    architectureNotes: 'Strict micro-service boundary: Web/Mobile client -> Traefik Ingress -> Auth & RBAC service -> Schedule Engine -> BullMQ Notification Dispatcher -> PostgreSQL partitioned tables with immutable audit logs.',
    techStack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'TailwindCSS', 'Docker'],
    infrastructureDeps: ['infra-ts', 'infra-react', 'infra-pg', 'infra-redis', 'infra-docker'],
    subsystems: [
      {
        id: 'p02-sub-client',
        name: 'Caregiver Portal & Clinical Dashboard',
        category: 'frontend',
        role: 'High-density schedule coordinator & real-time telemetry grid',
        protocol: 'HTTPS / WSS',
        description: 'Optimistic updates, offline IndexedDB cache, keyboard-navigable multi-patient adherence calendar.',
        tech: ['React', 'TypeScript', 'TailwindCSS'],
        coordinates: { x: -45, y: -40, z: 30 },
        dimensions: { width: 60, height: 35, depth: 40 },
        metrics: [{ label: 'First Contentful Paint', value: '0.42s' }, { label: 'Client Bundle', value: '112 KB gzip' }]
      },
      {
        id: 'p02-sub-api',
        name: 'Schedule Ingress Gateway',
        category: 'backend',
        role: 'REST/WebSocket gateway with JWT & RBAC clinical validation',
        protocol: 'HTTP/2 REST + WS',
        description: 'Enforces strict FHIR-compatible health data schemas, HIPAA compliance filters, and payload signing.',
        tech: ['Node.js', 'Express', 'Zod'],
        coordinates: { x: 10, y: -10, z: 50 },
        dimensions: { width: 55, height: 40, depth: 45 },
        metrics: [{ label: 'p95 API Latency', value: '18ms' }, { label: 'Auth Check', value: '1.2ms' }]
      },
      {
        id: 'p02-sub-queue',
        name: 'BullMQ Escalation Worker',
        category: 'queue',
        role: 'Time-jittered escalation dispatcher with dead-letter recovery',
        protocol: 'Redis Stream / PubSub',
        description: 'Executes progressive escalation paths (App push -> SMS -> Automated voice call) for unacknowledged doses.',
        tech: ['Redis', 'BullMQ', 'Twilio SDK'],
        coordinates: { x: 60, y: 20, z: 35 },
        dimensions: { width: 50, height: 30, depth: 35 },
        metrics: [{ label: 'Dispatch Precision', value: '±120ms' }, { label: 'Notification Delivery', value: '99.97%' }]
      },
      {
        id: 'p02-sub-db',
        name: 'PostgreSQL Audit Ledger',
        category: 'database',
        role: 'Append-only clinical event ledger with time-partitioned tables',
        protocol: 'Postgres Wire / SSL',
        description: 'Row-level security, immutable append logs for medication dispenses, and daily analytical materialized views.',
        tech: ['PostgreSQL 16', 'Drizzle ORM'],
        coordinates: { x: -10, y: 50, z: 25 },
        dimensions: { width: 70, height: 30, depth: 55 },
        metrics: [{ label: 'Query Execution (p90)', value: '3.8ms' }, { label: 'Zero Data Loss', value: 'Strict RPO=0' }]
      }
    ],
    metrics: [
      { label: 'Daily Doses Tracked', value: '42,000+', note: 'Active patients in production' },
      { label: 'Adherence Improvement', value: '+34.8%', note: 'Verified clinical outcome' },
      { label: 'Dispatch Punctuality', value: '99.99%', note: 'Delivered within 5s window' },
      { label: 'Uptime SLA', value: '99.99%', note: '24/7 continuous monitoring' }
    ],
    keyDecisions: [
      {
        decision: 'PostgreSQL JSONB + strict Zod schema validation over NoSQL document store',
        rationale: 'Maintains relational integrity between patients, doctors, and clinics while allowing flexible medical formulation attributes.',
        tradeoff: 'Requires manual migration scripts for deeply nested JSONB indexes.'
      },
      {
        decision: 'Dedicated BullMQ Redis clusters per tenant isolation ring',
        rationale: 'Prevents notification spikes from enterprise clinic onboarding from delaying emergency single-patient heart medication alerts.',
        tradeoff: 'Slightly higher Redis memory provisioning costs.'
      }
    ],
    resilienceTesting: 'Simulated 10,000 concurrent missed dose spikes, database failover tests with continuous write streams, and automated penetration audits for HIPAA compliance.',
    links: {
      demo: 'https://pillcheck.health/demo-portal',
      github: 'https://github.com/hafsah-sys/pillcheck-core',
      caseStudy: true
    }
  },
  {
    id: 'p03-chronostream',
    code: 'P03',
    title: 'ChronoStream',
    tagline: 'High-throughput time-series event processor & columnar Parquet engine',
    category: 'backend',
    status: 'PRODUCTION',
    year: '2023',
    dimensions: { width: 105, height: 80, levels: 3 },
    gridPosition: { x: -80, y: 70 },
    accentColor: '#8EA9DA',
    summary: 'Streaming ingestion pipeline capable of buffering and rolling 500,000 events/sec into compressed Apache Parquet chunks on S3, queryable sub-second via embedded DuckDB.',
    problem: 'Traditional time-series databases (Influx, Prometheus) became cost-prohibitive at scale (>5 TB/month) and struggled with ad-hoc analytical multi-dimensional SQL aggregations.',
    solution: 'Built an in-memory streaming aggregator using Rust and Go. It batches incoming events into 64MB memory-mapped columnar buffers, applies Zstandard compression, and writes partitioned Parquet files directly to object storage.',
    architectureNotes: 'Kafka buffer -> Rust batch processor with SIMD vectorization -> DuckDB vectorized query planner -> Arrow IPC stream back to client.',
    techStack: ['Rust', 'Go', 'DuckDB', 'Apache Arrow', 'Apache Kafka', 'Parquet', 'ClickHouse'],
    infrastructureDeps: ['infra-go', 'infra-pg', 'infra-redis', 'infra-ebpf'],
    subsystems: [
      {
        id: 'p03-sub-ingest',
        name: 'Kafka Ingestion Consumer Ring',
        category: 'queue',
        role: 'Parallel partition consumer with zero-copy deserializer',
        protocol: 'Kafka Binary Wire',
        description: 'Consumes partitioned event streams with lockless ring buffers and dynamic backpressure signaling.',
        tech: ['Rust', 'rdkafka'],
        coordinates: { x: -35, y: -25, z: 20 },
        dimensions: { width: 50, height: 25, depth: 35 },
        metrics: [{ label: 'Ingest Rate', value: '520k msg/s' }]
      },
      {
        id: 'p03-sub-parquet',
        name: 'Columnar Parquet Engine',
        category: 'backend',
        role: 'SIMD-accelerated columnar encoder & Zstd compressor',
        protocol: 'Memory mapped buffers',
        description: 'Encodes typed rows into Arrow RecordBatches, writing dictionary-encoded Parquet files.',
        tech: ['Rust', 'Apache Arrow', 'Zstd'],
        coordinates: { x: 15, y: 0, z: 40 },
        dimensions: { width: 60, height: 35, depth: 45 },
        metrics: [{ label: 'Compression Ratio', value: '7.8x' }, { label: 'CPU Overhead', value: '<12% on 8 cores' }]
      },
      {
        id: 'p03-sub-query',
        name: 'Vectorized DuckDB Server',
        category: 'database',
        role: 'Embedded SQL analytical engine over cold S3 files',
        protocol: 'Arrow Flight / gRPC',
        description: 'Executes vectorized OLAP aggregate queries with predicate pushdown directly over object storage.',
        tech: ['DuckDB', 'Arrow Flight'],
        coordinates: { x: -10, y: 40, z: 25 },
        dimensions: { width: 55, height: 25, depth: 40 },
        metrics: [{ label: 'Aggregation Speed', value: '42M rows/s' }]
      }
    ],
    metrics: [
      { label: 'Event Ingestion Rate', value: '520k /sec', note: 'Sustained peak workload' },
      { label: 'Storage Cost Reduction', value: '82%', note: 'Compared to managed TSDB' },
      { label: 'Query p95 Latency', value: '140ms', note: 'Aggregating 100M rows' }
    ],
    keyDecisions: [
      {
        decision: 'Apache Arrow IPC over custom binary protocol',
        rationale: 'Zero-copy serialization directly from Rust buffers to DuckDB query engine.',
        tradeoff: 'Stricter schema management requirements.'
      }
    ],
    resilienceTesting: 'Memory leak verification under continuous 7-day 1GB/sec load, crash-safe buffer recovery using WAL replays.',
    links: {
      github: 'https://github.com/hafsah-sys/chrono-stream',
      docs: 'https://github.com/hafsah-sys/chrono-stream/blob/main/SPEC.md',
      caseStudy: true
    }
  },
  {
    id: 'p04-vertexdb',
    code: 'P04',
    title: 'VertexDB Embedded',
    tagline: 'Embedded HNSW vector index & hybrid semantic retrieval pipeline',
    category: 'infrastructure',
    status: 'ACTIVE',
    year: '2024',
    dimensions: { width: 100, height: 75, levels: 3 },
    gridPosition: { x: 140, y: -30 },
    accentColor: '#8EA9DA',
    summary: 'A fast, embedded Hierarchical Navigable Small World (HNSW) vector search engine written in TypeScript and C++ with AVX-512 SIMD distance metrics, running in Node.js and Bun.',
    problem: 'Cloud vector databases (Pinecone, Weaviate) introduce 40-90ms external network hops and high recurring operational expenses for local desktop/edge AI workloads.',
    solution: 'Engineered an in-process vector store with quantization (Scalar and Product Quantization) reducing memory footprint by 75% with 99.2% recall retention at sub-2ms query times.',
    architectureNotes: 'C++ SIMD kernels exposed via N-API -> Lockless Graph Index in shared memory -> TypeScript filtering & BM25 hybrid ranking layer.',
    techStack: ['TypeScript', 'C++', 'Node-API', 'SIMD', 'WASM', 'Bun'],
    infrastructureDeps: ['infra-ts', 'infra-dist', 'infra-docker'],
    subsystems: [
      {
        id: 'p04-sub-hnsw',
        name: 'HNSW Graph Indexer',
        category: 'backend',
        role: 'Multi-layer proximity graph builder with dynamic edge pruning',
        protocol: 'Native Shared Memory',
        description: 'Maintains hierarchical graph layers for logarithmic nearest-neighbor search.',
        tech: ['C++', 'AVX2/AVX-512'],
        coordinates: { x: -20, y: -20, z: 35 },
        dimensions: { width: 50, height: 35, depth: 40 },
        metrics: [{ label: 'Index Build Speed', value: '45k vectors/s' }]
      },
      {
        id: 'p04-sub-hybrid',
        name: 'BM25 + Semantic Ranker',
        category: 'backend',
        role: 'Reciprocal Rank Fusion (RRF) between lexical and vector matches',
        protocol: 'IPC / Node N-API',
        description: 'Combines exact keyword matches with semantic embeddings using dense-sparse fusion.',
        tech: ['TypeScript', 'Rust (WASM)'],
        coordinates: { x: 25, y: 15, z: 25 },
        dimensions: { width: 45, height: 25, depth: 35 },
        metrics: [{ label: 'Recall @ 10', value: '99.4%' }]
      }
    ],
    metrics: [
      { label: 'Query Latency (1536-dim)', value: '1.4ms', note: '1M vectors on M2 / x86' },
      { label: 'Memory Per 100k Vectors', value: '38 MB', note: 'With 8-bit scalar quantization' },
      { label: 'Recall Accuracy', value: '99.2%', note: 'Tested against brute-force baseline' }
    ],
    keyDecisions: [
      {
        decision: 'Product Quantization over simple full-precision FP32 vectors',
        rationale: 'Allows running 5M vectors in under 2GB RAM on edge appliances without swap thrashing.',
        tradeoff: '0.8% decrease in recall precision at edge boundary thresholds.'
      }
    ],
    resilienceTesting: 'Concurrent read/write fuzzy benchmarking with 64 threads under high memory pressure.',
    links: {
      github: 'https://github.com/hafsah-sys/vertex-db',
      caseStudy: true
    }
  },
  {
    id: 'p05-polyglotast',
    code: 'P05',
    title: 'PolyglotAST',
    tagline: 'Universal incremental AST parser & codebase dependency graph visualizer',
    category: 'tooling',
    status: 'ACTIVE',
    year: '2023',
    dimensions: { width: 95, height: 70, levels: 3 },
    gridPosition: { x: -160, y: 30 },
    accentColor: '#C3E54E', // frontend technical lime
    summary: 'A high-performance codebase cartographer that parses TypeScript, Rust, Go, and Python repos in milliseconds, generating interactive 3D dependency matrices and circular reference audits.',
    problem: 'Monorepos with 50,000+ files lack instant visual understanding of architectural boundaries, leading to hidden coupling and circular dependency deadlocks.',
    solution: 'Integrated Tree-sitter WebAssembly parsers with a custom WebGL / Canvas force-directed spatial layout engine rendering 100,000 graph nodes at 60 FPS in browser.',
    architectureNotes: 'Multi-threaded Web Workers parsing ASTs -> Graph compaction worker -> WebGL spatial shader renderer -> React inspection overlay.',
    techStack: ['TypeScript', 'Tree-sitter', 'WebAssembly', 'WebGL', 'React', 'TailwindCSS'],
    infrastructureDeps: ['infra-ts', 'infra-react', 'infra-docker'],
    subsystems: [
      {
        id: 'p05-sub-parser',
        name: 'WASM Tree-sitter Pool',
        category: 'backend',
        role: 'Parallel incremental syntax tree generator in Web Workers',
        protocol: 'WebWorker PostMessage (Transferable Objects)',
        description: 'Parses raw source files into uniform Abstract Syntax Trees with zero main-thread jank.',
        tech: ['Tree-sitter', 'WASM', 'Web Workers'],
        coordinates: { x: -25, y: -20, z: 25 },
        dimensions: { width: 45, height: 25, depth: 35 },
        metrics: [{ label: 'Parse Speed', value: '14,000 LOC/ms' }]
      },
      {
        id: 'p05-sub-graph',
        name: 'WebGL Matrix Engine',
        category: 'frontend',
        role: 'GPU-accelerated spatial graph layout & edge bundler',
        protocol: 'WebGL Shader Pipeline',
        description: 'Simulates Barnes-Hut spatial forces on GPU compute passes for 100k nodes.',
        tech: ['WebGL', 'GLSL', 'Canvas2D'],
        coordinates: { x: 20, y: 15, z: 35 },
        dimensions: { width: 50, height: 30, depth: 40 },
        metrics: [{ label: 'Frame Rate', value: '60 FPS stable' }]
      }
    ],
    metrics: [
      { label: 'Repo Parse Time (100k LOC)', value: '180ms', note: 'Cold browser execution' },
      { label: 'Max Node Capacity', value: '120,000', note: 'Without frame drops' },
      { label: 'Circular Dependency Detect', value: '100%', note: 'Cycle-finding via Tarjan algorithm' }
    ],
    keyDecisions: [
      {
        decision: 'ArrayBuffer transferable objects between Web Workers',
        rationale: 'Eliminates JSON serialization bottlenecks when streaming 100,000 AST nodes.',
        tradeoff: 'Requires manual binary packing and unpacking routines.'
      }
    ],
    resilienceTesting: 'Stress-tested against the complete Linux kernel and TypeScript compiler source trees.',
    links: {
      demo: 'https://polyglot-ast.dev',
      github: 'https://github.com/hafsah-sys/polyglot-ast',
      caseStudy: false
    }
  },
  {
    id: 'p06-sentinellog',
    code: 'P06',
    title: 'SentinelLog eBPF Agent',
    tagline: 'Kernel-level distributed tracing daemon & zero-overhead network probe',
    category: 'infrastructure',
    status: 'PRODUCTION',
    year: '2024',
    dimensions: { width: 110, height: 85, levels: 4 },
    gridPosition: { x: 110, y: 80 },
    accentColor: '#8EA9DA',
    summary: 'A lightweight eBPF tracing agent that hooks into Linux socket filters and kprobes, reconstructing distributed HTTP/gRPC traces across microservices with zero application code modification.',
    problem: 'Traditional APM agents (Datadog, OpenTelemetry SDKs) inject 3-8% CPU overhead and require invasive code instrumentation across dozens of legacy microservices.',
    solution: 'Wrote Linux eBPF C programs attaching to `sys_enter_writev`, `tcp_sendmsg`, and `sock_recvmsg` to extract trace headers and correlation IDs directly from kernel memory with <0.3% CPU overhead.',
    architectureNotes: 'eBPF C kernel probes -> Go user-space ring buffer collector -> Batch processor -> ClickHouse columnar datastore.',
    techStack: ['Go', 'C (eBPF)', 'Linux Kernel', 'ClickHouse', 'OpenTelemetry', 'Docker'],
    infrastructureDeps: ['infra-go', 'infra-ebpf', 'infra-docker', 'infra-dist'],
    subsystems: [
      {
        id: 'p06-sub-ebpf',
        name: 'Kernel Socket Probes',
        category: 'backend',
        role: 'Non-invasive eBPF kprobe/tracepoint hooks',
        protocol: 'eBPF Ring Buffer',
        description: 'Captures socket payloads and protocol headers with zero context switching.',
        tech: ['C', 'eBPF / libbpf'],
        coordinates: { x: -30, y: -15, z: 35 },
        dimensions: { width: 50, height: 30, depth: 40 },
        metrics: [{ label: 'Probe Latency', value: '<180ns' }, { label: 'CPU Overhead', value: '0.22%' }]
      },
      {
        id: 'p06-sub-collector',
        name: 'Trace Stitcher Daemon',
        category: 'backend',
        role: 'Asynchronous span correlation and OTLP exporter',
        protocol: 'gRPC / OTLP',
        description: 'Correlates TCP socket tuples to distributed trace IDs and streams to ClickHouse.',
        tech: ['Go', 'OpenTelemetry SDK'],
        coordinates: { x: 25, y: 20, z: 30 },
        dimensions: { width: 55, height: 25, depth: 35 },
        metrics: [{ label: 'Export Throughput', value: '250k spans/s' }]
      }
    ],
    metrics: [
      { label: 'Runtime CPU Overhead', value: '0.22%', note: 'vs 4.8% on standard APM SDK' },
      { label: 'Trace Reconstruction', value: '99.98%', note: 'Zero loss across 10k RPS microservices' },
      { label: 'Memory Footprint', value: '24 MB', note: 'Daemon resident set size' }
    ],
    keyDecisions: [
      {
        decision: 'Direct eBPF ring buffers over legacy perf event buffers',
        rationale: 'Reduces memory allocation and prevents dropped traces during sudden network microbursts.',
        tradeoff: 'Requires Linux kernel 5.8+.'
      }
    ],
    resilienceTesting: 'Tested under high network saturation (40 Gbps synthetic traffic) with simulated kernel memory pressure.',
    links: {
      github: 'https://github.com/hafsah-sys/sentinel-log',
      docs: 'https://github.com/hafsah-sys/sentinel-log/tree/main/docs',
      caseStudy: true
    }
  },
  {
    id: 'p07-cartoui',
    code: 'P07',
    title: 'CartoUI Geometric Canvas',
    tagline: 'Precision architectural design system & geometric rendering primitives',
    category: 'frontend',
    status: 'ACTIVE',
    year: '2024',
    dimensions: { width: 95, height: 65, levels: 3 },
    gridPosition: { x: -10, y: 130 },
    accentColor: '#C3E54E',
    summary: 'A specialized UI toolkit and spatial canvas component system for engineering consoles, architectural schematics, and high-density technical dashboards (powers this very portfolio!).',
    problem: 'Standard web UI libraries (Material, Ant, Bootstrap) produce generic bubbly SaaS cards and lack mathematical isometric projection, crisp 1px drafting grids, and dense technical legibility.',
    solution: 'Built a bespoke toolkit with true axonometric coordinate projections, mathematical corner radius nesting, SVG hatch generators, and zero-jank interactive camera transforms.',
    architectureNotes: 'Vector math projection pipeline -> Layered Canvas & SVG rendering -> Virtualized viewport clipping -> Monospace typography tokens.',
    techStack: ['TypeScript', 'React', 'TailwindCSS', 'Canvas2D', 'SVG', 'Motion'],
    infrastructureDeps: ['infra-ts', 'infra-react'],
    subsystems: [
      {
        id: 'p07-sub-iso',
        name: 'Isometric Projection Engine',
        category: 'frontend',
        role: '3D-to-2D axonometric matrix transformations & depth sorting',
        protocol: 'Local Math Transform',
        description: 'Calculates isometric vectors, camera matrices, and topological occlusions in sub-millisecond frames.',
        tech: ['TypeScript', 'Matrix3D'],
        coordinates: { x: -20, y: -10, z: 25 },
        dimensions: { width: 45, height: 25, depth: 35 },
        metrics: [{ label: 'Render Latency', value: '1.2ms' }]
      }
    ],
    metrics: [
      { label: 'Bundle Footprint', value: '18 KB', note: 'Zero external graphic dependencies' },
      { label: 'Rendering FPS', value: '60 FPS', note: 'Continuous pan/zoom' }
    ],
    keyDecisions: [
      {
        decision: 'Hybrid SVG + Canvas architecture',
        rationale: 'SVG provides razor-sharp 1px lines at arbitrary zoom levels; Canvas handles dense dynamic particles and signal pulses.',
        tradeoff: 'Requires syncing two coordinate systems during pan operations.'
      }
    ],
    resilienceTesting: 'Cross-browser pixel alignment testing across Retina and standard DPI screens.',
    links: {
      github: 'https://github.com/hafsah-sys/carto-ui',
      caseStudy: false
    }
  }
];

export const INFRASTRUCTURE_SKILLS: InfrastructureSkill[] = [
  {
    id: 'infra-ts',
    code: 'INF-01',
    name: 'TypeScript & System Architecture',
    category: 'fullstack',
    yearsActive: 8,
    proficiencyScore: 98,
    gridPosition: { x: -20, y: -20 },
    systemCount: 7,
    usedInProjects: ['p01-aethermesh', 'p02-pillcheck', 'p04-vertexdb', 'p05-polyglotast', 'p07-cartoui'],
    primaryUseCases: [
      'Type-level programming & recursive AST validators',
      'High-performance backend services on Node & Bun',
      'Complex spatial renderers & state machines',
      'Strict Zod schema enforcement across API boundaries'
    ],
    technicalHighlights: [
      'Authored custom AST transformations and ESLint safety plugins',
      'Zero-any codebases with strict discriminated union exhaustiveness',
      'Performance profiling with V8 heap snapshots and CPU flame graphs'
    ],
    samplePattern: `type ImmutableDeep<T> = T extends Function | boolean | number | string | null | undefined
  ? T : T extends Map<infer K, infer V>
  ? ReadonlyMap<ImmutableDeep<K>, ImmutableDeep<V>>
  : { readonly [K in keyof T]: ImmutableDeep<T[K]> };`
  },
  {
    id: 'infra-go',
    code: 'INF-02',
    name: 'Go & Systems Concurrency',
    category: 'backend',
    yearsActive: 6,
    proficiencyScore: 94,
    gridPosition: { x: -100, y: -20 },
    systemCount: 4,
    usedInProjects: ['p01-aethermesh', 'p03-chronostream', 'p06-sentinellog'],
    primaryUseCases: [
      'High-throughput microservices & P2P network daemons',
      'Raft consensus implementations with goroutine channels',
      'Low-latency binary serialization and socket servers',
      'Linux eBPF user-space ring buffer collectors'
    ],
    technicalHighlights: [
      'Zero-allocation memory pooling with sync.Pool and unsafe pointers',
      'Lockless ring buffers and atomic CPU memory barriers',
      'Production profiling with pprof and runtime execution traces'
    ],
    samplePattern: `type RingBuffer[T any] struct {
  buf   []T
  head  atomic.Uint64
  tail  atomic.Uint64
  mask  uint64
}`
  },
  {
    id: 'infra-react',
    code: 'INF-03',
    name: 'React & Reactive UI Engineering',
    category: 'frontend',
    yearsActive: 7,
    proficiencyScore: 96,
    gridPosition: { x: -20, y: 50 },
    systemCount: 6,
    usedInProjects: ['p02-pillcheck', 'p05-polyglotast', 'p07-cartoui'],
    primaryUseCases: [
      'High-density engineering consoles and technical dashboards',
      'Custom SVG/Canvas2D spatial rendering engines',
      'Optimistic state reconciliation with offline IndexedDB stores',
      'Complex keyboard navigation and focus management'
    ],
    technicalHighlights: [
      'Avoidance of unnecessary re-renders via precise ref synchronization',
      'Custom spatial viewport hooks with matrix zoom-pan transforms',
      'Sub-millisecond interaction feedback and WCAG AA accessibility'
    ],
    samplePattern: `const useSpatialTransform = (initialScale = 1.0) => {
  const transformRef = useRef({ x: 0, y: 0, scale: initialScale });
  // Direct DOM matrix updates bypassing React render cycle for 60fps pan
};`
  },
  {
    id: 'infra-pg',
    code: 'INF-04',
    name: 'PostgreSQL & Columnar Databases',
    category: 'infrastructure',
    yearsActive: 7,
    proficiencyScore: 92,
    gridPosition: { x: 50, y: -20 },
    systemCount: 5,
    usedInProjects: ['p02-pillcheck', 'p03-chronostream'],
    primaryUseCases: [
      'Time-partitioned append-only audit ledgers',
      'Complex query optimization, EXPLAIN ANALYZE indexing',
      'DuckDB & ClickHouse OLAP aggregation pipelines',
      'Zero-downtime schema migrations with transactional DDL'
    ],
    technicalHighlights: [
      'Designed multi-tenant schema isolation models with Row Level Security (RLS)',
      'Configured WAL streaming replication and pg_stat_statements tuning',
      'Parquet file format generation with Zstd compression for data lakes'
    ],
    samplePattern: `CREATE TABLE clinical_audit_log (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
) PARTITION BY RANGE (created_at);`
  },
  {
    id: 'infra-dist',
    code: 'INF-05',
    name: 'Distributed Systems & Consensus',
    category: 'infrastructure',
    yearsActive: 5,
    proficiencyScore: 90,
    gridPosition: { x: -100, y: -110 },
    systemCount: 3,
    usedInProjects: ['p01-aethermesh', 'p04-vertexdb', 'p06-sentinellog'],
    primaryUseCases: [
      'Raft & Paxos leader election and log compaction',
      'CRDT state synchronization across partitioned nodes',
      'Vector clock ordering and causal consistency models',
      'High-assurance split-brain and network partition healing'
    ],
    technicalHighlights: [
      'Jepsen test suite automation for partition verification',
      'ChaosMesh fault injection across Kubernetes clusters',
      'Design of idempotent RPC message deduplication buffers'
    ],
    samplePattern: `// Vector clock dominance check
fn dominates(a: &VectorClock, b: &VectorClock) -> bool {
  a.iter().all(|(node, &epoch)| epoch >= b.get(node).copied().unwrap_or(0))
}`
  },
  {
    id: 'infra-redis',
    code: 'INF-06',
    name: 'Redis & Event Streaming (Kafka/BullMQ)',
    category: 'backend',
    yearsActive: 6,
    proficiencyScore: 93,
    gridPosition: { x: 70, y: 35 },
    systemCount: 4,
    usedInProjects: ['p02-pillcheck', 'p03-chronostream'],
    primaryUseCases: [
      'Distributed task queues with jittered retry & dead-letter routing',
      'Atomic distributed locks (Redlock) and rate limiting algorithms',
      'Pub/Sub event fanout for live WebSocket clients',
      'Real-time sliding-window telemetry counters'
    ],
    technicalHighlights: [
      'Engineered multi-stage escalation worker processing 10k jobs/min',
      'Lua script atomicity for complex inventory deductions',
      'Kafka consumer group rebalance tuning for zero message loss'
    ],
    samplePattern: `local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current <= tonumber(ARGV[2])`
  },
  {
    id: 'infra-docker',
    code: 'INF-07',
    name: 'Containers, Kubernetes & CI/CD',
    category: 'infrastructure',
    yearsActive: 6,
    proficiencyScore: 91,
    gridPosition: { x: 60, y: -80 },
    systemCount: 7,
    usedInProjects: ['p01-aethermesh', 'p02-pillcheck', 'p03-chronostream', 'p04-vertexdb', 'p05-polyglotast', 'p06-sentinellog'],
    primaryUseCases: [
      'Multi-stage Docker builds with minimal scratch/distroless bases',
      'Helm chart templating and Kubernetes deployment manifests',
      'Hermetic testing pipelines with GitHub Actions and ephemeral test DBs',
      'Infrastructure as Code (Terraform) across AWS and GCP'
    ],
    technicalHighlights: [
      'Reduced Docker image footprints from 1.2GB to 18MB via multi-stage Go compilation',
      'Zero-downtime rolling blue-green deployment strategies',
      'Automated security scanning with Trivy and Cosign container signing'
    ],
    samplePattern: `FROM golang:1.22-alpine AS builder
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /bin/daemon ./cmd/daemon
FROM scratch
COPY --from=builder /bin/daemon /bin/daemon
ENTRYPOINT ["/bin/daemon"]`
  },
  {
    id: 'infra-ebpf',
    code: 'INF-08',
    name: 'Linux Kernel, eBPF & Observability',
    category: 'backend',
    yearsActive: 4,
    proficiencyScore: 88,
    gridPosition: { x: 140, y: 40 },
    systemCount: 3,
    usedInProjects: ['p03-chronostream', 'p06-sentinellog'],
    primaryUseCases: [
      'Kernel socket tracing and network latency profiling',
      'OpenTelemetry distributed tracing pipelines',
      'Low-overhead CPU flame graphs and system call auditing',
      'ClickHouse columnar storage for high-cardinality logs'
    ],
    technicalHighlights: [
      'Developed eBPF programs passing BPF verifier constraints with zero runtime panics',
      'OTel collector pipeline configuration with batching and tail-sampling',
      'Real-time microservice topology reconstruction from TCP handshakes'
    ],
    samplePattern: `SEC("kprobe/tcp_sendmsg")
int BPF_KPROBE(trace_tcp_sendmsg, struct sock *sk, struct msghdr *msg, size_t size) {
  u32 pid = bpf_get_current_pid_tgid() >> 32;
  // Extract socket connection metadata
  return 0;
}`
  }
];

export const EXPERIENCE_HISTORY: ExperienceNode[] = [
  {
    id: 'exp-01',
    code: 'BUILD-04',
    yearRange: '2024 — PRESENT',
    role: 'Principal Systems Architect',
    organization: 'Nexus Labs',
    location: 'San Francisco, CA',
    systemDomain: 'Distributed Systems & Edge Computing Infrastructure',
    keyOutputs: [
      'Architected edge consensus layer synchronizing 150k edge nodes across 12 geographic zones',
      'Spearheaded transition to eBPF-based non-invasive observability, saving $340k/yr in APM tooling costs',
      'Mentored a team of 14 senior engineers across distributed Go, Rust, and TypeScript core modules',
      'Established company-wide RFC architecture review process and resilience verification benchmarks'
    ],
    systemsArchitected: ['AetherMesh Consensus Core', 'SentinelLog Network Tracer', 'Global Edge Mesh'],
    technologies: ['Go', 'Rust', 'eBPF', 'WebRTC', 'Kubernetes', 'ClickHouse'],
    gridPosition: { x: -140, y: -150 }
  },
  {
    id: 'exp-02',
    code: 'BUILD-03',
    yearRange: '2022 — 2024',
    role: 'Staff Full-Stack Engineer',
    organization: 'Kinetic Health Systems',
    location: 'San Francisco, CA',
    systemDomain: 'Clinical Telemetry & Healthcare Operations',
    keyOutputs: [
      'Designed high-assurance PillCheck platform achieving 99.99% notification delivery SLA across 42k patients',
      'Eliminated cold-start database connection exhaustion by implementing custom connection pool multiplexers',
      'Reduced caregiver dispatch latency from 4.2 seconds to 180 milliseconds through Redis BullMQ pipelines',
      'Led HIPAA and SOC 2 Type II technical audit certification with zero non-conformances'
    ],
    systemsArchitected: ['PillCheck Adherence Suite', 'Caregiver Real-time Portal', 'Clinical Audit Ledger'],
    technologies: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker'],
    gridPosition: { x: -40, y: -160 }
  },
  {
    id: 'exp-03',
    code: 'BUILD-02',
    yearRange: '2020 — 2022',
    role: 'Senior Infrastructure Engineer',
    organization: 'Apex Data Cloud',
    location: 'Remote',
    systemDomain: 'Time-Series Streaming & Vector Search Engines',
    keyOutputs: [
      'Built streaming ingestion engine processing 500k events/sec into compressed Parquet chunks',
      'Lowered analytical query latencies by 65% by introducing vectorized DuckDB query pushdown',
      'Wrote in-process vector retrieval libraries in C++ and TypeScript for sub-2ms semantic indexing',
      'Implemented automated chaos testing validating cluster recovery against network partitions'
    ],
    systemsArchitected: ['ChronoStream Engine', 'VertexDB Vector Store'],
    technologies: ['Rust', 'Go', 'Apache Arrow', 'DuckDB', 'Kafka', 'SIMD'],
    gridPosition: { x: 50, y: -160 }
  },
  {
    id: 'exp-04',
    code: 'BUILD-01',
    yearRange: '2018 — 2020',
    role: 'Software Engineer',
    organization: 'Quantum Metrics',
    location: 'Austin, TX',
    systemDomain: 'Developer Tooling & Interactive UI Engines',
    keyOutputs: [
      'Built WebGL-based AST codebase visualization engine capable of rendering 100k nodes at 60 FPS',
      'Engineered internal component design systems used by over 80 developers across 6 products',
      'Optimized client-side bundle sizes by 45% through custom Tree-shaking and WebWorker offloading',
      'Authored automated regression test suites covering 98% of business-critical state logic'
    ],
    systemsArchitected: ['PolyglotAST Cartographer', 'Spatial Component Library'],
    technologies: ['TypeScript', 'React', 'WebGL', 'Tree-sitter', 'Jest', 'Canvas2D'],
    gridPosition: { x: 130, y: -160 }
  }
];

export const ARCHITECTURE_PRINCIPLES: ArchitecturePrinciple[] = [
  {
    id: 'principle-01',
    number: '01',
    title: 'Isolate Failure Domains Explicitly',
    summary: 'No single component failure may cascade across system boundaries without localized mitigation.',
    elaboration: 'In every system I architect, components communicate across strict boundaries with time-bounded circuit breakers, dead-letter queues, and deterministic fallback modes. If the AI or analytics worker crashes, the core transactional ledger must continue operating without interruption.',
    appliedIn: ['p01-aethermesh', 'p02-pillcheck', 'p06-sentinellog']
  },
  {
    id: 'principle-02',
    number: '02',
    title: 'Mechanical Sympathy Over Layered Abstraction',
    summary: 'Understand the underlying hardware, memory layouts, and network wires instead of blindly stacking libraries.',
    elaboration: 'Memory-mapped files, columnar vectorization, zero-copy buffers, and single-pass data structures consistently outperform complex ORMs and bloated frameworks. Writing code that respects the CPU cache and network packet boundaries yields orders-of-magnitude gains.',
    appliedIn: ['p03-chronostream', 'p04-vertexdb', 'p06-sentinellog']
  },
  {
    id: 'principle-03',
    number: '03',
    title: 'State Invariants as First-Class Artifacts',
    summary: 'Model state transitions with formal finite state machines rather than scattered boolean flags.',
    elaboration: 'Every critical entity (order, dose, cluster node, connection) must have a formally defined set of valid states and allowable transitions. Invalid states should be rendered impossible to represent by the type system.',
    appliedIn: ['p01-aethermesh', 'p02-pillcheck', 'p05-polyglotast']
  },
  {
    id: 'principle-04',
    number: '04',
    title: 'Measure Before Optimizing (Zero Guesswork)',
    summary: 'Ground architectural decisions in flame graphs, eBPF probes, and synthetic load tests.',
    elaboration: 'Never optimize based on intuition. Use pprof, Linux perf, browser DevTools performance profilers, and Jepsen chaos verification to prove where latency and contention actually originate.',
    appliedIn: ['p03-chronostream', 'p06-sentinellog', 'p07-cartoui']
  },
  {
    id: 'principle-05',
    number: '05',
    title: 'Ergonomic Interfaces for Humans & Operators',
    summary: 'Internal developer tooling and external end-user UX deserve equal precision and polish.',
    elaboration: 'Software should provide high information density, instant responsiveness, keyboard fluency, and zero deceptive visual clutter. The user should always feel in complete control of the system.',
    appliedIn: ['p02-pillcheck', 'p05-polyglotast', 'p07-cartoui']
  }
];

export const TOPOLOGY_ZONES = [
  {
    id: 'zone-dist',
    name: 'ZONE A // DISTRIBUTED ENGINES & EDGE MESH',
    bounds: { x: -220, y: -140, width: 170, height: 160 },
    code: 'SEC-01',
    description: 'Consensus protocols, P2P state sync, and edge coordination daemons'
  },
  {
    id: 'zone-apps',
    name: 'ZONE B // HIGH-ASSURANCE PRODUCTION SYSTEMS',
    bounds: { x: 0, y: -160, width: 190, height: 160 },
    code: 'SEC-02',
    description: 'Clinical adherence pipelines, full-stack event platforms, and transactional backends'
  },
  {
    id: 'zone-data',
    name: 'ZONE C // TIME-SERIES & VECTOR INFRASTRUCTURE',
    bounds: { x: -220, y: 30, width: 180, height: 160 },
    code: 'SEC-03',
    description: 'Columnar Parquet streaming, in-process HNSW vector indexing, and AST analyzers'
  },
  {
    id: 'zone-telemetry',
    name: 'ZONE D // KERNEL PROBES & GEOMETRIC CANVAS',
    bounds: { x: 0, y: 30, width: 190, height: 160 },
    code: 'SEC-04',
    description: 'eBPF socket tracing, OpenTelemetry collectors, and CartoUI spatial renderers'
  }
];
