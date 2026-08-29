import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Crosshair, 
  Layers, 
  Activity, 
  ChevronRight, 
  ExternalLink,
  Info,
  Compass,
  ArrowUpRight,
  Database,
  Server,
  Terminal,
  Cpu,
  RotateCcw,
  Move,
  Magnet,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { 
  ProjectData, 
  InfrastructureSkill, 
  ExperienceNode, 
  ViewportState,
  TopologyViewMode
} from '../types';
import { VERIFIED_TOPOLOGY_ZONES as TOPOLOGY_ZONES } from '../data/verifiedPortfolioData';
import {
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';
import {
  findNearestValidGridPosition,
  checkCollisions,
  GRID_SNAP_STEP
} from '../utils/collision';
import {
  isProjectLinkedToExperience
} from '../utils/portfolioUtils';
import { CapabilityIcon } from './CapabilityIcon';
import { 
  projectUsesCapability, 
  getCapabilityCoreTechnology,
  getCapabilitiesLinkedToExperience
} from '../utils/capabilityAssociations';
import {
  calculateConduitGeometry,
  ConduitPathGeometry
} from '../utils/forceLayout';
import {
  assembleTopologyLayout,
  wrapCalloutTitle,
  getConduitPresentationState,
  getTopologyNodeEmphasis,
  getNodeEmphasisClassName,
  computeFitViewport
} from '../utils/topologyLayout';
import {
  ISO_COS,
  ISO_SIN,
  project3DToIso,
  projectIsoTo3D
} from '../utils/isometricProjection';
import {
  getTopologyProjectDimensions,
  PROJECT_CALLOUT_WIDTH,
  PROJECT_CALLOUT_SINGLE_HEIGHT,
  PROJECT_CALLOUT_DOUBLE_HEIGHT,
  PROJECT_CALLOUT_SINGLE_Y,
  PROJECT_CALLOUT_DOUBLE_Y
} from '../utils/projectTopologyGeometry';
import {
  getOrbitalProjectPositionAtPhase,
  isOrbitPauseConditionActive,
  stepOrbitClock,
  ORBIT_RESUME_DELAY_MS,
  type OrbitClockState,
  type OrbitPauseState
} from '../utils/orbitMotion';
import {
  resolveProjectDockState,
  getProjectVisualCenterIso,
  hasCrossedDetachThreshold,
  computeResistedWorldOrigin,
  computeFreeWorldOrigin,
  computeCaptureAttraction,
  computeMagneticRenderPosition,
  deriveDockState,
  resolveReleaseOutcome,
  stepSettleTransition,
  REDOCK_DURATION_MS,
  ABORTED_PULL_RETURN_MS,
  type ProjectDockState,
  type ProjectDockRuntimeMap,
  type SettleTransition
} from '../utils/projectDocking';

// Re-exported for backward compatibility: other modules (ProjectSubsystemCanvas,
// tests) import the isometric projection helpers from this component file. The
// canonical implementation lives in ../utils/isometricProjection.
export { ISO_COS, ISO_SIN, project3DToIso, projectIsoTo3D };

interface TopologyCanvasProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onDrillIntoProject: (id: string) => void;
  selectedSkillId: string | null;
  onSelectSkill: (id: string) => void;
  selectedExperienceId: string | null;
  searchQuery: string;
  topologyViewMode: TopologyViewMode;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  projects: ProjectData[];
  skills?: InfrastructureSkill[];
  experience?: ExperienceNode[];
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  selectedProjectId,
  onSelectProject,
  onDrillIntoProject,
  selectedSkillId,
  onSelectSkill,
  selectedExperienceId,
  searchQuery,
  topologyViewMode,
  viewport,
  setViewport,
  projects,
  skills,
  experience,
}) => {
  const activeSkills = useMemo(() => skills && skills.length > 0 ? skills : INFRASTRUCTURE_SKILLS, [skills]);
  const activeExperience = useMemo(() => experience && experience.length > 0 ? experience : EXPERIENCE_HISTORY, [experience]);

  // Static orbital lattice: deterministic collision-free ring layout used as the
  // canonical default for every node's position. Computed from the full (unfiltered)
  // project/skill sets so search filtering never perturbs slot allocation, and is
  // independent of topologyViewMode / selectedExperienceId so geometry never shifts
  // between view modes or under the Professional Experience filter.
  const staticOrbitalLattice = useMemo(
    () => assembleTopologyLayout(projects, activeSkills),
    [projects, activeSkills]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredSkillId, setHoveredSkillId] = useState<string | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 1000, height: 700 });

  // Custom dragged positions for 3D project structures and skill nodes
  const [customProjectPositions, setCustomProjectPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [customSkillPositions, setCustomSkillPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Grid snap state (enabled by default)
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [snapNotice, setSnapNotice] = useState<{ message: string; type: 'snap' | 'collision' } | null>(null);

  // Active node drag state with live position tracking. PR23 adds project-only
  // magnetic docking fields (undefined for skills, which keep PR21's plain
  // free-drag behavior untouched): `crossedDetachThreshold` is a sticky
  // per-gesture flag (see projectDocking.ts's deriveDockState), `breakaway`
  // is the pointer/position baseline captured exactly once — either at
  // gesture start (already-detached project) or at the instant the detach
  // threshold is crossed (docked project pulled loose) — so free-drag math
  // never has to reference the original gesture start again, and `rawPos` is
  // the pointer-derived position BEFORE any magnetic capture blend is applied
  // (tracked separately so attraction preview never corrupts the real drag
  // position — see PR23 spec section 20).
  const [draggingNode, setDraggingNode] = useState<{
    type: 'project' | 'skill';
    id: string;
    startClientX: number;
    startClientY: number;
    startNodePos: { x: number; y: number };
    currentPos: { x: number; y: number };
    hasMoved: boolean;
    crossedDetachThreshold?: boolean;
    breakaway?: { clientX: number; clientY: number; worldPos: { x: number; y: number } };
    rawPos?: { x: number; y: number };
  } | null>(null);

  // PR23: runtime-only project docking state. Sparse — an absent entry means
  // docked. Never written to ProjectData/GITHUB_SNAPSHOT/src/data.
  const [projectDockState, setProjectDockState] = useState<ProjectDockRuntimeMap>({});

  // PR23: the single short-lived settle-animation transition (aborted-pull
  // return OR redock settle — same mechanism, different duration). At most
  // one project may be settling at a time. `dockTransitionRef` is the
  // interpolation source of truth for the RAF loop; `activeDockTransitionProjectId`
  // is the reactive flag that starts/stops that loop and feeds the orbit
  // pause state; `dockTransitionRenderPos` is the position the render layer
  // actually reads each frame.
  const dockTransitionRef = useRef<(SettleTransition & { projectId: string }) | null>(null);
  const [activeDockTransitionProjectId, setActiveDockTransitionProjectId] = useState<string | null>(null);
  const [dockTransitionRenderPos, setDockTransitionRenderPos] = useState<{ x: number; y: number } | null>(null);

  // ---------------------------------------------------------------------------
  // PR22: Orbital motion. ONE shared phase drives every canonical (non-custom)
  // project's position around the PR21 static ellipse. No per-project timers,
  // no animation library — a single requestAnimationFrame loop advances one
  // phase value; positions are a pure derivation of it (orbitMotion.ts).
  // ---------------------------------------------------------------------------

  const isCompactViewport = containerDimensions.width < 1024;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const [isDocumentHidden, setIsDocumentHidden] = useState<boolean>(
    () => typeof document !== 'undefined' && document.hidden
  );
  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // One ring, one phase, one pause state — never per-project.
  const orbitPauseState: OrbitPauseState = useMemo(() => ({
    isProjectHovered: Boolean(hoveredProjectId),
    isSkillHovered: Boolean(hoveredSkillId),
    isProjectSelected: Boolean(selectedProjectId),
    isSkillSelected: Boolean(selectedSkillId),
    isNodeDragging: Boolean(draggingNode),
    isCanvasPanning: isDragging,
    isDocumentHidden,
    prefersReducedMotion,
    isCompact: isCompactViewport,
    isExperienceSelected: Boolean(selectedExperienceId),
    isDockingTransitionActive: Boolean(activeDockTransitionProjectId),
  }), [
    hoveredProjectId, hoveredSkillId, selectedProjectId, selectedSkillId,
    draggingNode, isDragging, isDocumentHidden, prefersReducedMotion,
    isCompactViewport, selectedExperienceId, activeDockTransitionProjectId
  ]);
  const isPauseConditionActive = useMemo(
    () => isOrbitPauseConditionActive(orbitPauseState),
    [orbitPauseState]
  );

  // Transient interactions (hover/drag/pan) shouldn't cause immediate stop/start
  // jitter: once every pause condition clears, wait ORBIT_RESUME_DELAY_MS before
  // actually resuming. Persistent conditions (selection, reduced motion, compact,
  // hidden) keep isPauseConditionActive true, so they never reach this timer.
  const [isResumeReady, setIsResumeReady] = useState(true);
  useEffect(() => {
    if (isPauseConditionActive) {
      setIsResumeReady(false);
      return;
    }
    const timer = setTimeout(() => setIsResumeReady(true), ORBIT_RESUME_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isPauseConditionActive]);

  const isOrbitRunning = !isPauseConditionActive && isResumeReady;

  const [orbitPhase, setOrbitPhase] = useState(0);
  const orbitClockRef = useRef<OrbitClockState>({ phase: 0, lastTimestamp: null });

  // The RAF loop is only ALIVE while isOrbitRunning is true — at most one
  // active chain, and genuinely zero scheduled repeating callbacks while
  // paused (compact, reduced motion, hover/selection/drag/pan, hidden tab,
  // or an active Experience filter), rather than a mount-lifetime loop that
  // keeps waking the browser and merely holding position. Every pause clears
  // lastTimestamp (not the phase itself) so a later resume re-baselines
  // instead of applying a catch-up jump for however long it was paused.
  useEffect(() => {
    if (!isOrbitRunning) {
      orbitClockRef.current = { phase: orbitClockRef.current.phase, lastTimestamp: null };
      return;
    }

    let rafId: number;
    const tick = (timestamp: number) => {
      const next = stepOrbitClock(orbitClockRef.current, timestamp, true);
      orbitClockRef.current = next;
      setOrbitPhase(next.phase);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOrbitRunning]);

  const projectsById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  // Pure derivation from orbitPhase + staticOrbitalLattice + projects — no
  // per-frame allocation beyond this one small map rebuild.
  const animatedCanonicalProjectPositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const slot of staticOrbitalLattice.orbitGeometry.slots) {
      const project = projectsById.get(slot.projectId);
      if (!project) continue;
      positions[slot.projectId] = getOrbitalProjectPositionAtPhase(
        project,
        slot,
        staticOrbitalLattice.orbitGeometry,
        orbitPhase
      );
    }
    return positions;
  }, [staticOrbitalLattice, projectsById, orbitPhase]);

  // Effective position maps: the animated canonical orbit as the base layer,
  // with any manually dragged/assembled positions layered on top. Passed to
  // collision & snap-resolution so they always agree with what is actually
  // rendered. A project present in customProjectPositions stays fixed there —
  // it does not resume orbiting until ASSEMBLE clears the override (a future
  // PR will formalize this as an explicit membership state machine).
  const effectiveProjectPositions = useMemo(
    () => ({ ...animatedCanonicalProjectPositions, ...customProjectPositions }),
    [animatedCanonicalProjectPositions, customProjectPositions]
  );
  const effectiveSkillPositions = useMemo(
    () => ({ ...staticOrbitalLattice.skillPositions, ...customSkillPositions }),
    [staticOrbitalLattice, customSkillPositions]
  );

  // PR23: cancels any in-flight settle transition without finalizing it —
  // used by ASSEMBLE/RESET, which resolve every project to canonical docked
  // membership through their own explicit state clearing instead.
  const cancelDockTransition = useCallback(() => {
    dockTransitionRef.current = null;
    setActiveDockTransitionProjectId(null);
    setDockTransitionRenderPos(null);
  }, []);

  // Starts (or, under reduced motion, instantly finalizes) the settle
  // animation that carries a project from its current rendered position to
  // `toPos` — used for both an aborted pull (returns to the reserved slot)
  // and a valid magnetic redock (also the reserved slot). Finalization always
  // clears both the custom position override and the dock-runtime exception,
  // which is a safe no-op when either was never set (e.g. an aborted pull
  // never wrote a custom position in the first place).
  const finalizeProjectAsDocked = useCallback((projectId: string) => {
    setCustomProjectPositions(prev => {
      if (!(projectId in prev)) return prev;
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    setProjectDockState(prev => {
      if (!(projectId in prev)) return prev;
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  }, []);

  const startSettleTransition = useCallback((
    projectId: string,
    fromPos: { x: number; y: number },
    toPos: { x: number; y: number },
    durationMs: number
  ) => {
    if (prefersReducedMotion) {
      finalizeProjectAsDocked(projectId);
      return;
    }
    dockTransitionRef.current = { projectId, fromPos, toPos, durationMs, startTimestamp: null };
    setActiveDockTransitionProjectId(projectId);
    setDockTransitionRenderPos(fromPos);
  }, [prefersReducedMotion, finalizeProjectAsDocked]);

  // The ONE short-lived docking-settle RAF loop — alive only while an actual
  // transition is in progress (never a persistent per-project loop), gated
  // exactly like the PR22 orbit clock. Elapsed-time based via
  // stepSettleTransition, so frame-rate variance cannot change perceived speed.
  useEffect(() => {
    if (!activeDockTransitionProjectId) return;

    let rafId: number;
    const tick = (timestamp: number) => {
      const transition = dockTransitionRef.current;
      if (!transition) return;

      const result = stepSettleTransition(transition, timestamp);
      if (transition.startTimestamp === null) {
        dockTransitionRef.current = { ...transition, startTimestamp: timestamp };
      }
      setDockTransitionRenderPos(result.position);

      if (result.isComplete) {
        const finishedProjectId = transition.projectId;
        dockTransitionRef.current = null;
        setActiveDockTransitionProjectId(null);
        setDockTransitionRenderPos(null);
        finalizeProjectAsDocked(finishedProjectId);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeDockTransitionProjectId, finalizeProjectAsDocked]);

  // Synchronized node position getters for 100% frame-accurate alignment
  const getProjectPos = useCallback((project: ProjectData) => {
    if (draggingNode?.type === 'project' && draggingNode.id === project.id) {
      return draggingNode.currentPos;
    }
    if (activeDockTransitionProjectId === project.id && dockTransitionRenderPos) {
      return dockTransitionRenderPos;
    }
    return effectiveProjectPositions[project.id] || project.gridPosition;
  }, [draggingNode, effectiveProjectPositions, activeDockTransitionProjectId, dockTransitionRenderPos]);

  const getSkillPos = useCallback((skill: InfrastructureSkill) => {
    if (draggingNode?.type === 'skill' && draggingNode.id === skill.id) {
      return draggingNode.currentPos;
    }
    return effectiveSkillPositions[skill.id] || skill.gridPosition;
  }, [draggingNode, effectiveSkillPositions]);

  // PR23: derives the actively-dragged project's magnetic dock state, distance/
  // attraction to its own reserved slot, and whether that slot is currently
  // blocked by another detached project. This is the single source both the
  // live tether/marker rendering and the mouseup release decision read from —
  // it never invents a second, disagreeing notion of "how close is capture."
  const activeDockingPreview = useMemo(() => {
    if (!draggingNode || draggingNode.type !== 'project') return null;
    const project = projectsById.get(draggingNode.id);
    const reservedOrigin = animatedCanonicalProjectPositions[draggingNode.id];
    if (!project || !reservedOrigin) return null;

    const persisted = resolveProjectDockState(projectDockState, draggingNode.id);
    const crossed = draggingNode.crossedDetachThreshold ?? false;
    const rawPos = draggingNode.rawPos ?? draggingNode.currentPos;

    let attraction = computeCaptureAttraction(Infinity);
    if (crossed || persisted === 'detached') {
      const rawCenter = getProjectVisualCenterIso(project, rawPos);
      const reservedCenter = getProjectVisualCenterIso(project, reservedOrigin);
      const distanceIso = Math.hypot(rawCenter.x - reservedCenter.x, rawCenter.y - reservedCenter.y);
      attraction = computeCaptureAttraction(distanceIso);
    }

    const dockState = deriveDockState({
      persistedState: persisted,
      isDragging: true,
      hasCrossedThresholdThisGesture: crossed,
      isWithinCaptureRadius: attraction.isWithinCaptureRadius,
    });

    const isBlocked = dockState === 'capturing'
      ? checkCollisions('project', draggingNode.id, reservedOrigin, effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills).hasCollision
      : false;

    return { project, reservedOrigin, dockState, attraction, isBlocked, rawPos };
  }, [draggingNode, projectsById, animatedCanonicalProjectPositions, projectDockState, effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills]);

  // Check if a skill and project are connected through centralized association engine
  const isSkillConnectedToProject = useCallback((skillId: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const skill = activeSkills.find(s => s.id === skillId);
    if (!project || !skill) return false;
    return projectUsesCapability(project, skill);
  }, [projects, activeSkills]);

  // Active focus target (hovered node has top priority, followed by selected node)
  const activeFocusProjectId = hoveredProjectId || (hoveredSkillId ? null : selectedProjectId);
  const activeFocusSkillId = hoveredSkillId || (hoveredProjectId ? null : selectedSkillId);
  const isHoverFocus = Boolean(hoveredProjectId || hoveredSkillId);
  const isNodeFocused = Boolean(hoveredProjectId || hoveredSkillId || selectedProjectId || selectedSkillId);

  // Set of connected skills for the currently focused project
  const focusedConnectedSkillIds = useMemo(() => {
    if (!activeFocusProjectId) return new Set<string>();
    const set = new Set<string>();
    activeSkills.forEach(s => {
      if (isSkillConnectedToProject(s.id, activeFocusProjectId)) {
        set.add(s.id);
      }
    });
    return set;
  }, [activeFocusProjectId, activeSkills, isSkillConnectedToProject]);

  // Set of connected projects for the currently focused skill
  const focusedConnectedProjectIds = useMemo(() => {
    if (!activeFocusSkillId) return new Set<string>();
    const set = new Set<string>();
    projects.forEach(p => {
      if (isSkillConnectedToProject(activeFocusSkillId, p.id)) {
        set.add(p.id);
      }
    });
    return set;
  }, [activeFocusSkillId, projects, isSkillConnectedToProject]);

  // Selected Experience Context & Experience-Linked Capabilities
  const selectedExp = useMemo(() => {
    return selectedExperienceId ? activeExperience.find(e => e.id === selectedExperienceId) || null : null;
  }, [selectedExperienceId, activeExperience]);

  const experienceLinkedSkillIds = useMemo(() => {
    if (!selectedExp) return new Set<string>();
    return getCapabilitiesLinkedToExperience(selectedExp, projects, activeSkills);
  }, [selectedExp, projects, activeSkills]);

  // Resets manual overrides AND the shared orbit phase back to canonical 0.
  // No return to legacy project.gridPosition — the animated canonical lattice
  // is the default. Motion resumes from phase 0 only if no pause condition
  // currently prohibits it (e.g. the panel this was opened from is still
  // hovered) — this does not force-start the ring.
  const resetOrbitPhaseToCanonical = useCallback(() => {
    orbitClockRef.current = { phase: 0, lastTimestamp: null };
    setOrbitPhase(0);
  }, []);

  // PR23: ASSEMBLE/RESET both mean "restore complete canonical orbital
  // system" — cancel any active drag, cancel any in-flight settle animation
  // (no 18-project physics pass, this is instant), clear every custom
  // position AND every dock-runtime exception so all projects become docked,
  // then reset phase to 0. Motion resumes only if PR22's pause rules allow it.
  const restoreCanonicalDockMembership = useCallback(() => {
    setDraggingNode(null);
    cancelDockTransition();
    setCustomProjectPositions({});
    setCustomSkillPositions({});
    setProjectDockState({});
    resetOrbitPhaseToCanonical();
  }, [cancelDockTransition, resetOrbitPhaseToCanonical]);

  const resetAllPositions = useCallback(() => {
    restoreCanonicalDockMembership();
    setSnapNotice({ message: 'TOPOLOGY POSITIONS RESET TO DEFAULT', type: 'snap' });
    setTimeout(() => setSnapNotice(null), 2400);
  }, [restoreCanonicalDockMembership]);

  // Restores the canonical static orbital lattice by clearing manual overrides
  // and resetting the shared orbit phase to 0. The lattice is now the default
  // fallback itself (see staticOrbitalLattice/animatedCanonicalProjectPositions
  // above), so ASSEMBLE no longer needs to copy coordinates into custom state.
  // No snapping/tweening animation for the restore itself — a future PR may add one.
  const handleAssemble = useCallback(() => {
    restoreCanonicalDockMembership();
    setSnapNotice({ message: 'TOPOLOGY RESTORED // CANONICAL ORBITAL LATTICE', type: 'snap' });
    setTimeout(() => setSnapNotice(null), 2400);
  }, [restoreCanonicalDockMembership]);

  const hasCustomPositions = useMemo(() => {
    return Object.keys(customProjectPositions).length > 0 ||
      Object.keys(customSkillPositions).length > 0;
  }, [customProjectPositions, customSkillPositions]);

  // Real-time preview calculation of snapped & collision-free landing spot
  const dragResolution = useMemo(() => {
    if (!draggingNode || !draggingNode.hasMoved) return null;
    return findNearestValidGridPosition(
      draggingNode.type,
      draggingNode.id,
      draggingNode.currentPos,
      effectiveProjectPositions,
      effectiveSkillPositions,
      projects,
      activeSkills,
      GRID_SNAP_STEP,
      gridSnapEnabled
    );
  }, [draggingNode, effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills, gridSnapEnabled]);

  // Real-time raw collision warning if directly hovering over another node
  const liveCollision = useMemo(() => {
    if (!draggingNode || !draggingNode.hasMoved) return null;
    return checkCollisions(
      draggingNode.type,
      draggingNode.id,
      draggingNode.currentPos,
      effectiveProjectPositions,
      effectiveSkillPositions,
      projects,
      activeSkills
    );
  }, [draggingNode, effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills]);

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Auto-fit function to center and fit the actual orbital lattice bounds
  // (compact <lg and desktop aware). On desktop, autonomous orbital motion is
  // enabled, so FIT ALL frames motionVisualBounds — the conservative bounds
  // that stay valid across the ENTIRE revolution, not just the current phase —
  // otherwise a slow pan/zoom mismatch would appear as the ring turns. Compact
  // viewports never run the orbit (PR21-style static lattice), so they use the
  // tighter static visualBounds instead. minZoom here is only a last-resort
  // safety floor against pathological (near-zero) layouts — it must stay low
  // enough to never bind for realistic project counts, since a binding floor
  // would silently defeat the fit it's supposed to protect. This is
  // independent of the manual wheel/keyboard zoom floor (0.45) used elsewhere.
  const fitAll = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 800;
    const h = containerRef.current.clientHeight || 600;
    const isCompact = w < 1024;
    const bounds = isCompact
      ? staticOrbitalLattice.orbitGeometry.visualBounds
      : staticOrbitalLattice.orbitGeometry.motionVisualBounds;
    const { zoom, x, y } = computeFitViewport(bounds, w, h, {
      paddingFactor: isCompact ? 0.92 : 0.95,
      minZoom: isCompact ? 0.15 : 0.20,
      maxZoom: 1.2,
    });
    setViewport({ x, y, zoom });
  }, [setViewport, staticOrbitalLattice]);

  // Initial mount auto-fit
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && containerDimensions.width > 200 && containerDimensions.height > 200) {
      initializedRef.current = true;
      fitAll();
    }
  }, [containerDimensions, fitAll]);

  // Keyboard controls for zoom, fit, snap toggle, and reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '0' || e.key.toLowerCase() === 'f') {
        fitAll();
      } else if (e.key === '+' || e.key === '=') {
        setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.15, 2.5) }));
      } else if (e.key === '-' || e.key === '_') {
        setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.15, 0.45) }));
      } else if (e.key.toLowerCase() === 'g') {
        setGridSnapEnabled(prev => {
          const next = !prev;
          setSnapNotice({
            message: next ? 'GRID SNAP: ENGAGED [25PX]' : 'FREEFORM DRAG MODE: ACTIVE',
            type: 'snap'
          });
          setTimeout(() => setSnapNotice(null), 2000);
          return next;
        });
      } else if (e.key.toLowerCase() === 'r' && (e.altKey || e.metaKey)) {
        resetAllPositions();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitAll, resetAllPositions, setViewport]);

  // Filter projects using search query
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      return searchQuery === '' || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [projects, searchQuery]);

  // Global window mousemove & mouseup listeners for buttery smooth dragging
  // with snap/collision resolution (skills) or magnetic docking mechanics
  // (projects). Mouse and touch share the exact same pure calculations —
  // processMove/processRelease only differ in how they read the pointer
  // coordinate from the native event.
  useEffect(() => {
    if (!draggingNode) return;

    const processMove = (clientX: number, clientY: number) => {
      const deltaScreenX = (clientX - draggingNode.startClientX) / viewport.zoom;
      const deltaScreenY = (clientY - draggingNode.startClientY) / viewport.zoom;
      const moved = Math.hypot(deltaScreenX, deltaScreenY) > 3;

      if (draggingNode.type === 'skill') {
        const delta3D = projectIsoTo3D(deltaScreenX, deltaScreenY);
        const newPos = {
          x: Math.round(draggingNode.startNodePos.x + delta3D.x),
          y: Math.round(draggingNode.startNodePos.y + delta3D.y),
        };
        setDraggingNode(prev => prev ? { ...prev, currentPos: newPos, hasMoved: prev.hasMoved || moved } : null);
        setCustomSkillPositions(prev => ({ ...prev, [draggingNode.id]: newPos }));
        return;
      }

      // PROJECT: magnetic docking mechanics. No customProjectPositions write
      // during the gesture — the whole in-progress pull/drag/capture lives in
      // draggingNode; a persistent override is only ever written on release.
      setDraggingNode(prev => {
        if (!prev || prev.type !== 'project') return prev;

        let crossedDetachThreshold = prev.crossedDetachThreshold ?? false;
        let breakaway = prev.breakaway;
        let rawPos: { x: number; y: number };

        if (!crossedDetachThreshold) {
          if (hasCrossedDetachThreshold(deltaScreenX, deltaScreenY)) {
            // Breakaway: capture the exact resisted position and pointer
            // baseline ONCE, so free drag continues from here with zero jump.
            crossedDetachThreshold = true;
            const positionAtCrossing = computeResistedWorldOrigin(prev.startNodePos, deltaScreenX, deltaScreenY);
            breakaway = { clientX, clientY, worldPos: positionAtCrossing };
            rawPos = positionAtCrossing;
          } else {
            rawPos = computeResistedWorldOrigin(prev.startNodePos, deltaScreenX, deltaScreenY);
          }
        } else {
          const baseline = breakaway!;
          const freeDeltaX = (clientX - baseline.clientX) / viewport.zoom;
          const freeDeltaY = (clientY - baseline.clientY) / viewport.zoom;
          rawPos = computeFreeWorldOrigin(baseline.worldPos, freeDeltaX, freeDeltaY);
        }

        // Magnetic capture preview: only once free of resistance, blend the
        // RENDERED position toward the (live, phase-frozen-by-pause) reserved
        // slot without ever touching rawPos itself — and never if the target
        // is currently blocked by another detached project.
        let renderedPos = rawPos;
        if (crossedDetachThreshold) {
          const project = projectsById.get(prev.id);
          const reservedOrigin = animatedCanonicalProjectPositions[prev.id];
          if (project && reservedOrigin) {
            const rawCenter = getProjectVisualCenterIso(project, rawPos);
            const reservedCenter = getProjectVisualCenterIso(project, reservedOrigin);
            const distanceIso = Math.hypot(rawCenter.x - reservedCenter.x, rawCenter.y - reservedCenter.y);
            const attraction = computeCaptureAttraction(distanceIso);
            if (attraction.isWithinCaptureRadius) {
              const blocked = checkCollisions(
                'project', prev.id, reservedOrigin, effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills
              ).hasCollision;
              if (!blocked) {
                renderedPos = computeMagneticRenderPosition(rawPos, reservedOrigin, attraction.strength);
              }
            }
          }
        }

        return {
          ...prev,
          crossedDetachThreshold,
          breakaway,
          rawPos,
          currentPos: renderedPos,
          hasMoved: prev.hasMoved || moved,
        };
      });
    };

    const processRelease = () => {
      if (!draggingNode) return;

      if (draggingNode.type === 'skill') {
        if (!draggingNode.hasMoved) {
          onSelectSkill(draggingNode.id);
        } else {
          const resolved = findNearestValidGridPosition(
            'skill', draggingNode.id, draggingNode.currentPos,
            effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills,
            GRID_SNAP_STEP, gridSnapEnabled
          );
          const finalPos = { x: resolved.x, y: resolved.y };
          setCustomSkillPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
          if (resolved.wasAdjusted) {
            setSnapNotice({ message: `AUTO-ALIGNED // PREVENTED OVERLAP WITH ${resolved.collidingWith || 'ADJACENT NODE'}`, type: 'collision' });
            setTimeout(() => setSnapNotice(null), 2500);
          } else if (gridSnapEnabled) {
            setSnapNotice({ message: `SNAPPED TO GRID [X:${finalPos.x}, Y:${finalPos.y}]`, type: 'snap' });
            setTimeout(() => setSnapNotice(null), 1800);
          }
        }
        setDraggingNode(null);
        return;
      }

      // PROJECT
      if (!draggingNode.hasMoved) {
        // A true click survives untouched: select, dock state unchanged.
        onSelectProject(draggingNode.id);
        setDraggingNode(null);
        return;
      }

      const project = projectsById.get(draggingNode.id);
      const reservedOrigin = animatedCanonicalProjectPositions[draggingNode.id];
      const persisted = resolveProjectDockState(projectDockState, draggingNode.id);
      const crossed = draggingNode.crossedDetachThreshold ?? false;
      const rawPos = draggingNode.rawPos ?? draggingNode.currentPos;

      let attraction = computeCaptureAttraction(Infinity);
      if ((crossed || persisted === 'detached') && project && reservedOrigin) {
        const rawCenter = getProjectVisualCenterIso(project, rawPos);
        const reservedCenter = getProjectVisualCenterIso(project, reservedOrigin);
        const distanceIso = Math.hypot(rawCenter.x - reservedCenter.x, rawCenter.y - reservedCenter.y);
        attraction = computeCaptureAttraction(distanceIso);
      }

      const dockStateAtRelease = deriveDockState({
        persistedState: persisted,
        isDragging: true,
        hasCrossedThresholdThisGesture: crossed,
        isWithinCaptureRadius: attraction.isWithinCaptureRadius,
      });

      const isBlocked = dockStateAtRelease === 'capturing' && reservedOrigin
        ? checkCollisions('project', draggingNode.id, reservedOrigin, effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills).hasCollision
        : false;

      const outcome = resolveReleaseOutcome(dockStateAtRelease, isBlocked);

      if (outcome === 'docked' && reservedOrigin) {
        // Magnetic dock has drop priority — this branch runs BEFORE any grid
        // snap is even considered. Aborted pull and valid redock share the
        // same settle mechanism; only the duration differs.
        const duration = dockStateAtRelease === 'detaching' ? ABORTED_PULL_RETURN_MS : REDOCK_DURATION_MS;
        startSettleTransition(draggingNode.id, draggingNode.currentPos, reservedOrigin, duration);
        setSnapNotice({
          message: dockStateAtRelease === 'detaching'
            ? 'MAGNETIC RELEASE // RETURNING TO SLOT'
            : 'DOCK TARGET ACQUIRED // REDOCKING',
          type: 'snap',
        });
        setTimeout(() => setSnapNotice(null), 1800);
      } else {
        // Ordinary free placement: existing grid-snap/collision resolution,
        // persisted as a detached custom position.
        const resolved = findNearestValidGridPosition(
          'project', draggingNode.id, rawPos,
          effectiveProjectPositions, effectiveSkillPositions, projects, activeSkills,
          GRID_SNAP_STEP, gridSnapEnabled
        );
        const finalPos = { x: resolved.x, y: resolved.y };
        setCustomProjectPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
        setProjectDockState(prev => ({ ...prev, [draggingNode.id]: { state: 'detached' } }));
        if (resolved.wasAdjusted) {
          setSnapNotice({ message: `AUTO-ALIGNED // PREVENTED OVERLAP WITH ${resolved.collidingWith || 'ADJACENT NODE'}`, type: 'collision' });
          setTimeout(() => setSnapNotice(null), 2500);
        } else if (gridSnapEnabled) {
          setSnapNotice({ message: `SNAPPED TO GRID [X:${finalPos.x}, Y:${finalPos.y}]`, type: 'snap' });
          setTimeout(() => setSnapNotice(null), 1800);
        }
      }

      setDraggingNode(null);
    };

    const handleWindowMouseMove = (e: MouseEvent) => processMove(e.clientX, e.clientY);
    const handleWindowMouseUp = () => processRelease();
    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      processMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleWindowTouchEnd = () => processRelease();

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
    };
  }, [
    draggingNode, viewport.zoom, effectiveProjectPositions, effectiveSkillPositions,
    gridSnapEnabled, onSelectProject, onSelectSkill, projects, activeSkills,
    projectsById, animatedCanonicalProjectPositions, projectDockState, startSettleTransition
  ]);

  // Handle Pan & Drag on canvas surface
  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggingNode) return;
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) return;
    if (isDragging) {
      setViewport(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(viewport.zoom * zoomFactor, 0.45), 2.5);
    setViewport(prev => ({
      ...prev,
      zoom: newZoom,
    }));
  };

  // Touch handlers for mobile pan/zoom
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (draggingNode) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - viewport.x, y: e.touches[0].clientY - viewport.y });
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchStartDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggingNode) return;
    if (e.touches.length === 1 && isDragging) {
      setViewport(prev => ({
        ...prev,
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      }));
    } else if (e.touches.length === 2 && touchStartDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDist;
      setViewport(prev => ({
        ...prev,
        zoom: Math.min(Math.max(prev.zoom * (ratio > 1 ? 1.03 : 0.97), 0.45), 2.5),
      }));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchStartDist(null);
  };

  // Center coordinate offset for isometric canvas
  const centerX = containerDimensions.width / 2;
  const centerY = containerDimensions.height / 2;

  // Render Connections / Cables between projects and their connected infrastructure skills
  const renderedConnections = useMemo(() => {
    const connections: React.ReactNode[] = [];
    const connectedPairs = new Set<string>();

    const isAnyProjectHovered = Boolean(hoveredProjectId);
    const isAnySkillHovered = Boolean(hoveredSkillId);
    const isAnyProjectSelected = Boolean(selectedProjectId);
    const isAnySkillSelected = Boolean(selectedSkillId);
    const isAnyDragging = Boolean(draggingNode);

    filteredProjects.forEach(project => {
      const isProjectSelected = selectedProjectId === project.id;
      const isProjectHovered = hoveredProjectId === project.id;
      const isDraggingThisProj = draggingNode?.type === 'project' && draggingNode.id === project.id;
      const projectPos = getProjectPos(project);
      
      const { width: pWidth, depth: pDepth } = getTopologyProjectDimensions(project);

      activeSkills.forEach(skill => {
        // Check if project and skill are connected using centralized predicate
        const isConnected = projectUsesCapability(project, skill);
        if (!isConnected) return;

        const pairKey = `${project.id}-${skill.id}`;
        if (connectedPairs.has(pairKey)) return;
        connectedPairs.add(pairKey);

        const isSkillSelected = selectedSkillId === skill.id;
        const isSkillHovered = hoveredSkillId === skill.id;
        const isDraggingThisSkill = draggingNode?.type === 'skill' && draggingNode.id === skill.id;

        const isProjectLinkedToExp = selectedExp ? isProjectLinkedToExperience(project, selectedExp) : false;
        const isSkillLinkedToExp = experienceLinkedSkillIds.has(skill.id);

        const presentationState = getConduitPresentationState({
          isConnected,
          isProjectHovered,
          isSkillHovered,
          isProjectSelected,
          isSkillSelected,
          isDraggingThisProject: isDraggingThisProj,
          isDraggingThisSkill: isDraggingThisSkill,
          isAnyProjectHovered,
          isAnySkillHovered,
          isAnyProjectSelected,
          isAnySkillSelected,
          isAnyDragging,
          showBackgroundRelationships: topologyViewMode === 'relationships',
          isSelectedExpActive: Boolean(selectedExperienceId),
          isProjectLinkedToExp,
          isSkillLinkedToExp
        });

        if (presentationState === 'hidden') return;

        const skillPos = getSkillPos(skill);

        const conduitGeom = calculateConduitGeometry(
          { x: projectPos.x, y: projectPos.y, width: pWidth, height: pDepth, type: 'project' },
          { x: skillPos.x, y: skillPos.y, width: 48, height: 48, type: 'skill' },
          pairKey,
          project.id,
          skill.id,
          'project',
          'skill'
        );

        const { startIso, midIso, endIso, pathData, tension } = conduitGeom;
        const isDraggingState = presentationState === 'dragging';
        const isDirectHover = isProjectHovered || isSkillHovered;

        if (presentationState === 'background') {
          // Subdued, static schematic trace line — subordinate to the orbit itself
          connections.push(
            <g key={pairKey} className="opacity-35 transition-opacity duration-200">
              <path
                d={pathData}
                fill="none"
                stroke="rgba(21, 21, 15, 0.35)"
                strokeWidth={0.7}
                strokeDasharray="3 3"
              />
              <circle cx={startIso.x} cy={startIso.y} r={1.5} fill="#15150F" />
              <circle cx={midIso.x} cy={midIso.y} r={1.6} fill="#15150F" />
              <circle cx={endIso.x} cy={endIso.y} r={1.5} fill="#15150F" />
            </g>
          );
          return;
        }

        // Focused or Dragging state: connected nodes are the stars, the line is
        // supporting evidence — a thin ink trace with a subtle lime support
        // stroke underneath, not a thick highway competing with the orbit's
        // own motion for attention.
        const endpointRadius = isDirectHover ? 2.5 : 2;
        const junctionRadius = isDirectHover ? 3 : 2.5;

        connections.push(
          <g
            key={pairKey}
            className="transition-opacity duration-200 opacity-100"
          >
            {/* Subtle lime support stroke */}
            <path
              d={pathData}
              fill="none"
              stroke="#C3E54E"
              strokeWidth={isDirectHover ? 2.2 : 1.8}
              strokeOpacity={isDirectHover ? 0.5 : 0.35}
              strokeLinecap="round"
              className="transition-all duration-150"
            />

            {/* Ink main path — the primary line weight */}
            <path
              d={pathData}
              fill="none"
              stroke="#15150F"
              strokeWidth={isDirectHover ? 1.2 : 0.9}
              className="transition-colors duration-150"
            />

            {/* Elastic tension feedback while actively dragging this exact edge's endpoint */}
            {isDraggingState && (
              <path
                d={pathData}
                fill="none"
                stroke={tension > 0.45 ? '#FF7B72' : '#C3E54E'}
                strokeWidth={2.5}
                strokeOpacity={0.6}
                strokeLinecap="round"
              />
            )}

            {/* Direction-of-signal cue: extremely subtle, only under direct hover — the
                orbit itself provides motion, conduits should not compete with it. */}
            {isDirectHover && (
              <path
                d={pathData}
                fill="none"
                stroke="#15150F"
                strokeWidth={1}
                strokeOpacity={0.5}
                className="signal-conduit-fast"
              />
            )}

            {/* Anchor Port at Project Foundation */}
            <circle
              cx={startIso.x}
              cy={startIso.y}
              r={endpointRadius}
              fill="#C3E54E"
              stroke="#15150F"
              strokeWidth={1}
            />

            {/* Junction dot at midpoint */}
            <circle
              cx={midIso.x}
              cy={midIso.y}
              r={junctionRadius}
              fill={tension > 0.5 ? '#FF7B72' : '#C3E54E'}
              stroke="#15150F"
              strokeWidth={1}
            />

            {/* Anchor Port at Skill Plinth */}
            <circle
              cx={endIso.x}
              cy={endIso.y}
              r={endpointRadius}
              fill="#C3E54E"
              stroke="#15150F"
              strokeWidth={1}
            />
          </g>
        );
      });
    });

    return connections;
  }, [
    selectedProjectId, 
    hoveredProjectId, 
    selectedSkillId, 
    hoveredSkillId, 
    topologyViewMode,
    filteredProjects,
    activeSkills,
    getProjectPos,
    getSkillPos,
    draggingNode
  ]);

  return (
    <div 
      ref={containerRef}
      id="portfolio-topology-canvas"
      className={`relative flex-1 w-full h-full overflow-hidden bg-[#D4CDA4] technical-grid select-none ${
        draggingNode ? 'cursor-grabbing' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visual Corner Framing / Region Labels */}
      <div className="hidden lg:flex absolute top-3 left-3 pointer-events-none items-center gap-1.5 text-[9px] font-mono text-[#15150F] z-10 bg-[#D4CDA4]/90 px-2 py-1 border border-[#15150F] border-l-2 border-b-2">
        <Compass size={11} className="text-[#15150F]" />
        <span className="font-bold">APPLICATION SURFACE // CORE WORK</span>
      </div>

      {/* Snap / Collision Toast Notification */}
      {snapNotice && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2 px-3 py-1.5 bg-[#15150F] text-[#D4CDA4] border border-[#15150F] font-mono text-[9.5px] font-bold shadow-[3px_3px_0px_#15150F] animate-in fade-in slide-in-from-top-2 duration-150">
          {snapNotice.type === 'collision' ? (
            <ShieldAlert size={13} className="text-[#E5534E] shrink-0" />
          ) : (
            <Magnet size={13} className="text-[#C3E54E] shrink-0" />
          )}
          <span className={snapNotice.type === 'collision' ? 'text-[#FF7B72]' : 'text-[#C3E54E]'}>
            {snapNotice.message}
          </span>
        </div>
      )}

      {/* Bottom-Left Controls & Status */}
      <div className="hidden lg:flex absolute bottom-3 left-3 pointer-events-none items-center gap-2 text-[9px] font-mono text-[#15150F] z-10">
        <div className="bg-[#D4CDA4]/90 px-2 py-1 border border-[#15150F] border-l-2 border-t-2">
          <span className="font-bold">TECHNICAL CAPABILITIES // SYSTEM BACKBONE</span>
        </div>
        <button
          onClick={() => setGridSnapEnabled(prev => !prev)}
          className={`pointer-events-auto px-2 py-1 border border-[#15150F] text-[8.5px] font-bold flex items-center gap-1 transition-colors ${
            gridSnapEnabled ? 'bg-[#C3E54E] text-[#15150F]' : 'bg-[#15150F] text-[#9E997F]'
          }`}
          title="Toggle Grid Snapping & Overlap Prevention (G)"
        >
          <Magnet size={10} />
          <span>GRID SNAP: {gridSnapEnabled ? 'ON (25PX)' : 'OFF'}</span>
        </button>
        {hasCustomPositions && (
          <div className="bg-[#15150F] text-[#C3E54E] px-2 py-1 border border-[#15150F] text-[8.5px] font-bold flex items-center gap-1">
            <Move size={10} />
            <span>CUSTOM LAYOUT ACTIVE</span>
          </div>
        )}
      </div>

      {/* Top-Right Viewport & Dragging Telemetry */}
      <div className="hidden lg:flex absolute top-3 right-3 pointer-events-none items-center gap-2 text-[9px] font-mono text-[#15150F] z-10 bg-[#D4CDA4]/90 px-2.5 py-1 border border-[#15150F]">
        <span>X: {viewport.x} Y: {viewport.y}</span>
        <span className="text-[#5C5946]">|</span>
        <span>SCALE: {viewport.zoom.toFixed(2)}x</span>
        {draggingNode && (
          <>
            <span className="text-[#5C5946]">|</span>
            <span className="text-[#15150F] font-bold bg-[#C3E54E] px-1">
              DRAGGING: {draggingNode.id.toUpperCase()}
            </span>
            {dragResolution && (
              <>
                <span className="text-[#5C5946]">|</span>
                <span className={`px-1 font-bold ${dragResolution.wasAdjusted ? 'bg-[#E5534E] text-white' : 'bg-[#15150F] text-[#C3E54E]'}`}>
                  TARGET: [{dragResolution.x}, {dragResolution.y}]
                  {dragResolution.wasAdjusted && ` (COLLISION DEFLECTED)`}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-14 lg:bottom-4 right-3 lg:right-4 flex flex-col gap-1.5 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAssemble();
          }}
          className="hidden lg:flex px-2 h-8 bg-[#15150F] border border-[#15150F] items-center justify-center gap-1 text-[#C3E54E] font-mono text-[9px] font-bold hover:bg-[#25241B] hover:text-[#D5F06E] transition-colors shadow-[2px_2px_0px_#15150F]"
          title="Restore Canonical Static Orbital Lattice"
        >
          <Layers size={12} />
          <span>ASSEMBLE</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setGridSnapEnabled(prev => {
              const next = !prev;
              setSnapNotice({
                message: next ? 'GRID SNAP: ENGAGED [25PX]' : 'FREEFORM DRAG MODE: ACTIVE',
                type: 'snap'
              });
              setTimeout(() => setSnapNotice(null), 2000);
              return next;
            });
          }}
          className={`w-9 h-9 lg:w-8 lg:h-8 border border-[#15150F] flex items-center justify-center transition-colors shadow-[2px_2px_0px_#15150F] ${
            gridSnapEnabled ? 'bg-[#C3E54E] text-[#15150F]' : 'bg-[#15150F] text-[#9E997F] hover:text-[#D4CDA4]'
          }`}
          title="Toggle Grid Snapping (G)"
        >
          <Magnet size={13} />
        </button>

        {hasCustomPositions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetAllPositions();
            }}
            className="px-2 h-9 lg:h-8 bg-[#15150F] border border-[#15150F] flex items-center justify-center gap-1 text-[#D4CDA4] font-mono text-[9px] font-bold hover:text-[#C3E54E] hover:bg-[#25241B] transition-colors shadow-[2px_2px_0px_#15150F]"
            title="Reset Nodes to Default Schematic (Alt+R)"
          >
            <RotateCcw size={12} />
            <span className="hidden lg:inline">RESET</span>
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.2, 2.5) }));
          }}
          className="w-9 h-9 lg:w-8 lg:h-8 bg-[#15150F] border border-[#15150F] flex items-center justify-center text-[#D4CDA4] hover:text-[#C3E54E] hover:bg-[#25241B] transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.2, 0.45) }));
          }}
          className="w-9 h-9 lg:w-8 lg:h-8 bg-[#15150F] border border-[#15150F] flex items-center justify-center text-[#D4CDA4] hover:text-[#C3E54E] hover:bg-[#25241B] transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            fitAll();
          }}
          className="px-2 h-9 lg:h-8 bg-[#C3E54E] border border-[#15150F] flex items-center justify-center gap-1 text-[#15150F] font-mono text-[9px] font-bold hover:bg-[#D5F06E] transition-colors shadow-[2px_2px_0px_#15150F]"
          title="Fit All Nodes (0 or F)"
        >
          <Maximize2 size={12} />
          <span>FIT ALL</span>
        </button>
      </div>

      {/* Main SVG Render Surface */}
      <svg
        className="w-full h-full absolute inset-0 pointer-events-auto overflow-hidden"
      >
        <defs>
          {/* Architectural hatching pattern for structure plinths */}
          <pattern id="hatch-arch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#15150F" strokeWidth="1.2" strokeOpacity="0.4" />
          </pattern>
          <pattern id="hatch-dense" width="4" height="4" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="4" stroke="#15150F" strokeWidth="1" strokeOpacity="0.5" />
          </pattern>
        </defs>

        {/* Scaled & Translated Isometric World Scene */}
        <g
          id="scene-root"
          transform={`translate(${centerX + viewport.x}, ${centerY + viewport.y}) scale(${viewport.zoom})`}
        >
          {/* Global Coordinate Axes */}
        <g id="axes" className="opacity-35">
          <line x1="-800" y1="0" x2="800" y2="0" stroke="#15150F" strokeWidth="0.5" strokeDasharray="4 8" />
          <line x1="0" y1="-600" x2="0" y2="600" stroke="#15150F" strokeWidth="0.5" strokeDasharray="4 8" />
          {/* Axis ticks */}
          {[-600, -400, -200, 200, 400, 600].map(val => (
            <React.Fragment key={val}>
              <line x1={val} y1="-5" x2={val} y2="5" stroke="#15150F" strokeWidth="1" />
              <text x={val + 4} y="-8" fontSize="7" fill="#5C5946" fontFamily="monospace">X:{val}</text>
              <line x1="-5" y1={val} x2="5" y2={val} stroke="#15150F" strokeWidth="1" />
              <text x="8" y={val + 3} fontSize="7" fill="#5C5946" fontFamily="monospace">Y:{val}</text>
            </React.Fragment>
          ))}
        </g>

        {/* Regional Zone Boundaries */}
        <g id="zones" className={`transition-opacity duration-200 ${isHoverFocus ? 'opacity-25' : 'opacity-100'}`}>
          {TOPOLOGY_ZONES.map(zone => {
            const topLeftIso = project3DToIso(zone.bounds.x, zone.bounds.y, 0);
            const topRightIso = project3DToIso(zone.bounds.x + zone.bounds.width, zone.bounds.y, 0);
            const bottomRightIso = project3DToIso(zone.bounds.x + zone.bounds.width, zone.bounds.y + zone.bounds.height, 0);
            const bottomLeftIso = project3DToIso(zone.bounds.x, zone.bounds.y + zone.bounds.height, 0);

            const path = `M ${topLeftIso.x} ${topLeftIso.y} L ${topRightIso.x} ${topRightIso.y} L ${bottomRightIso.x} ${bottomRightIso.y} L ${bottomLeftIso.x} ${bottomLeftIso.y} Z`;

            return (
              <g key={zone.id}>
                <path
                  d={path}
                  fill="rgba(21, 21, 15, 0.025)"
                  stroke="#15150F"
                  strokeWidth="0.8"
                  strokeDasharray="6 6"
                />
                {/* Zone Label */}
                <text
                  x={topLeftIso.x + 8}
                  y={topLeftIso.y - 10}
                  fontSize="8"
                  fontWeight="bold"
                  fill="#5C5946"
                  fontFamily="monospace"
                  letterSpacing="1"
                >
                  {zone.name}
                </text>
                {/* Corner registration crosshairs */}
                <path d={`M ${topLeftIso.x - 4} ${topLeftIso.y} L ${topLeftIso.x + 4} ${topLeftIso.y} M ${topLeftIso.x} ${topLeftIso.y - 4} L ${topLeftIso.x} ${topLeftIso.y + 4}`} stroke="#15150F" strokeWidth="1" />
                <path d={`M ${topRightIso.x - 4} ${topRightIso.y} L ${topRightIso.x + 4} ${topRightIso.y} M ${topRightIso.x} ${topRightIso.y - 4} L ${topRightIso.x} ${topRightIso.y + 4}`} stroke="#15150F" strokeWidth="1" />
                <path d={`M ${bottomRightIso.x - 4} ${bottomRightIso.y} L ${bottomRightIso.x + 4} ${bottomRightIso.y} M ${bottomRightIso.x} ${bottomRightIso.y - 4} L ${bottomRightIso.x} ${bottomRightIso.y + 4}`} stroke="#15150F" strokeWidth="1" />
                <path d={`M ${bottomLeftIso.x - 4} ${bottomLeftIso.y} L ${bottomLeftIso.x + 4} ${bottomLeftIso.y} M ${bottomLeftIso.x} ${bottomLeftIso.y - 4} L ${bottomLeftIso.x} ${bottomLeftIso.y + 4}`} stroke="#15150F" strokeWidth="1" />
              </g>
            );
          })}
        </g>

        {/* Static Orbit Track: subtle drafting-style guide for the single project ellipse */}
        <g id="static-orbit-track" className="pointer-events-none" opacity={0.2}>
          <ellipse
            cx={staticOrbitalLattice.orbitGeometry.centerIso.x}
            cy={staticOrbitalLattice.orbitGeometry.centerIso.y}
            rx={staticOrbitalLattice.orbitGeometry.radiusX}
            ry={staticOrbitalLattice.orbitGeometry.radiusY}
            fill="none"
            stroke="#15150F"
            strokeWidth="0.8"
            strokeDasharray="6 6"
          />
        </g>

        {/* Cable / Routing Connections Layer */}
        <g id="wiring-conduits">
          {renderedConnections}
        </g>

        {/* Infrastructure Skills Nodes Layer - Draggable & Dynamic Hover Connected */}
        <g id="infrastructure-nodes">
          {activeSkills.map(skill => {
            const isSelected = selectedSkillId === skill.id;
            const isHovered = hoveredSkillId === skill.id;
            const isSkillConnected = focusedConnectedSkillIds.has(skill.id);
            const isThisDragging = draggingNode?.type === 'skill' && draggingNode.id === skill.id;
            const isAnyFocus = isHoverFocus || Boolean(selectedProjectId) || Boolean(selectedSkillId) || Boolean(draggingNode);
            const isSkillLinkedToExp = experienceLinkedSkillIds.has(skill.id);
            const emphasis = getTopologyNodeEmphasis({
              nodeType: 'skill',
              mode: topologyViewMode,
              isHovered,
              isSelected,
              isDragging: isThisDragging,
              isConnectedToFocus: isSkillConnected,
              isAnyFocusActive: isAnyFocus,
              isSelectedExpActive: Boolean(selectedExperienceId),
              isLinkedToSelectedExp: false,
              isSkillLinkedToExp
            });
            const isHighlighted = emphasis === 'highlighted';
            const emphasisClass = getNodeEmphasisClassName(emphasis);

            const skillPos = getSkillPos(skill);
            const posIso = project3DToIso(skillPos.x, skillPos.y, 0);

            // Hexagonal / Diamond Plinth
            const r = isHighlighted ? 26 : 24;
            const p1 = { x: posIso.x, y: posIso.y - r * 0.7 };
            const p2 = { x: posIso.x + r * ISO_COS, y: posIso.y - r * 0.35 };
            const p3 = { x: posIso.x + r * ISO_COS, y: posIso.y + r * 0.35 };
            const p4 = { x: posIso.x, y: posIso.y + r * 0.7 };
            const p5 = { x: posIso.x - r * ISO_COS, y: posIso.y + r * 0.35 };
            const p6 = { x: posIso.x - r * ISO_COS, y: posIso.y - r * 0.35 };

            return (
              <g
                key={skill.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingNode({
                    type: 'skill',
                    id: skill.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startNodePos: { ...skillPos },
                    currentPos: { ...skillPos },
                    hasMoved: false,
                  });
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  if (e.touches.length === 1) {
                    setDraggingNode({
                      type: 'skill',
                      id: skill.id,
                      startClientX: e.touches[0].clientX,
                      startClientY: e.touches[0].clientY,
                      startNodePos: { ...skillPos },
                      currentPos: { ...skillPos },
                      hasMoved: false,
                    });
                  }
                }}
                onMouseEnter={() => setHoveredSkillId(skill.id)}
                onMouseLeave={() => setHoveredSkillId(null)}
                className={`cursor-grab active:cursor-grabbing group transition-all duration-200 ${emphasisClass}`}
              >
                {/* Active Connected Radar Halo when connected to hovered project */}
                {isSkillConnected && hoveredProjectId && (
                  <circle
                    cx={posIso.x}
                    cy={posIso.y}
                    r="32"
                    fill="none"
                    stroke="#C3E54E"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="animate-spin"
                    opacity="0.85"
                  />
                )}

                {/* Plinth Base */}
                <polygon
                  points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y} ${p5.x},${p5.y} ${p6.x},${p6.y}`}
                  fill={
                    isThisDragging || isSkillConnected 
                      ? '#C3E54E' 
                      : isSelected 
                        ? '#15150F' 
                        : isHovered 
                          ? '#CBC59B' 
                          : '#DCD6B2'
                  }
                  stroke="#15150F"
                  strokeWidth={isSelected || isThisDragging || isSkillConnected ? '2' : '1'}
                />

                {/* Technology Vector Mark / Monogram */}
                <CapabilityIcon
                  label={getCapabilityCoreTechnology(skill)}
                  x={posIso.x}
                  y={posIso.y}
                  size={isHighlighted ? 22 : 20}
                  color={isSelected ? '#C3E54E' : '#15150F'}
                />

                {/* Skill Code & Usage Count Label */}
                <text
                  x={posIso.x}
                  y={posIso.y + 24}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="bold"
                  fill={isSelected ? '#15150F' : isSkillConnected ? '#15150F' : '#3D3A2C'}
                  fontFamily="monospace"
                >
                  {getCapabilityCoreTechnology(skill)}
                </text>
                <text
                  x={posIso.x}
                  y={posIso.y + 33}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight={isSkillConnected ? 'bold' : 'normal'}
                  fill={isSkillConnected ? '#15150F' : '#6B664F'}
                  fontFamily="monospace"
                >
                  {isSkillConnected && hoveredProjectId ? 'CONNECTED // ' : ''}{skill.systemCount} SYSTEMS
                </text>
              </g>
            );
          })}
        </g>



        {/* Snap & Collision Landing Footprint Preview */}
        {draggingNode && draggingNode.hasMoved && dragResolution && (
          <g id="drag-landing-snap-footprint" className="pointer-events-none">
            {(() => {
              const currentIso = project3DToIso(draggingNode.currentPos.x, draggingNode.currentPos.y, 0);
              const targetIso = project3DToIso(dragResolution.x, dragResolution.y, 0);
              const isAdjusted = dragResolution.wasAdjusted;

              // Project structure footprint
              if (draggingNode.type === 'project') {
                const proj = projects.find(p => p.id === draggingNode.id);
                const { width: w, depth: d } = getTopologyProjectDimensions(proj);

                const p0 = project3DToIso(dragResolution.x, dragResolution.y, 0);
                const p1 = project3DToIso(dragResolution.x + w, dragResolution.y, 0);
                const p2 = project3DToIso(dragResolution.x + w, dragResolution.y + d, 0);
                const p3 = project3DToIso(dragResolution.x, dragResolution.y + d, 0);

                const centerSnapX = (p0.x + p2.x) / 2;
                const centerSnapY = (p0.y + p2.y) / 2;

                return (
                  <g>
                    {/* Snap Guide Line */}
                    <line
                      x1={currentIso.x}
                      y1={currentIso.y}
                      x2={centerSnapX}
                      y2={centerSnapY}
                      stroke={isAdjusted ? '#E5534E' : '#15150F'}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />

                    {/* Snapped Ground Footprint */}
                    <polygon
                      points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                      fill={isAdjusted ? 'rgba(229, 83, 78, 0.25)' : 'rgba(195, 229, 78, 0.35)'}
                      stroke={isAdjusted ? '#E5534E' : '#15150F'}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />

                    {/* Corner Crosshair Anchors */}
                    {[p0, p1, p2, p3].map((pt, i) => (
                      <g key={i}>
                        <line x1={pt.x - 3} y1={pt.y} x2={pt.x + 3} y2={pt.y} stroke="#15150F" strokeWidth="1.5" />
                        <line x1={pt.x} y1={pt.y - 3} x2={pt.x} y2={pt.y + 3} stroke="#15150F" strokeWidth="1.5" />
                      </g>
                    ))}

                    {/* Target Coordinates Tag */}
                    <g transform={`translate(${centerSnapX}, ${centerSnapY - 14})`}>
                      <rect
                        x="-48"
                        y="-10"
                        width="96"
                        height="20"
                        fill="#15150F"
                        stroke={isAdjusted ? '#E5534E' : '#C3E54E'}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fontSize="7.5"
                        fontWeight="bold"
                        fill={isAdjusted ? '#FF7B72' : '#C3E54E'}
                        fontFamily="monospace"
                      >
                        {isAdjusted ? 'AUTO-AVOID OVERLAP' : `SNAP [${dragResolution.x}, ${dragResolution.y}]`}
                      </text>
                    </g>
                  </g>
                );
              } else {
                // Skill or Experience circular footprint
                const r = draggingNode.type === 'skill' ? 24 : 16;
                return (
                  <g>
                    {/* Snap Guide Line */}
                    <line
                      x1={currentIso.x}
                      y1={currentIso.y}
                      x2={targetIso.x}
                      y2={targetIso.y}
                      stroke={isAdjusted ? '#E5534E' : '#15150F'}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />

                    {/* Snapped Target Circle */}
                    <circle
                      cx={targetIso.x}
                      cy={targetIso.y}
                      r={r}
                      fill={isAdjusted ? 'rgba(229, 83, 78, 0.25)' : 'rgba(195, 229, 78, 0.35)'}
                      stroke={isAdjusted ? '#E5534E' : '#15150F'}
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />

                    {/* Crosshair */}
                    <line x1={targetIso.x - 5} y1={targetIso.y} x2={targetIso.x + 5} y2={targetIso.y} stroke="#15150F" strokeWidth="1" />
                    <line x1={targetIso.x} y1={targetIso.y - 5} x2={targetIso.x} y2={targetIso.y + 5} stroke="#15150F" strokeWidth="1" />

                    {/* Tag */}
                    <g transform={`translate(${targetIso.x}, ${targetIso.y - 20})`}>
                      <rect
                        x="-38"
                        y="-8"
                        width="76"
                        height="16"
                        fill="#15150F"
                        stroke={isAdjusted ? '#E5534E' : '#C3E54E'}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fontSize="7"
                        fontWeight="bold"
                        fill={isAdjusted ? '#FF7B72' : '#C3E54E'}
                        fontFamily="monospace"
                      >
                        {isAdjusted ? 'SLOT ADJUSTED' : `SNAP [${dragResolution.x},${dragResolution.y}]`}
                      </text>
                    </g>
                  </g>
                );
              }
            })()}
          </g>
        )}

        {/* Project Structures (Brutalist Axonometric 3D Black Boxes - Draggable & Dynamic Hover Responsive) */}
        <g id="project-structures">
          {filteredProjects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            const isHovered = hoveredProjectId === project.id;
            const isThisDragging = draggingNode?.type === 'project' && draggingNode.id === project.id;

            // PR23: magnetic docking render state. The actively-dragged project's
            // dockState comes from activeDockingPreview (the single source shared
            // with the mouseup release decision); a project mid-settle-animation
            // is rendered as 'capturing' until the transition completes; every
            // other project reads its persisted (docked/detached) state.
            const isThisRedocking = activeDockTransitionProjectId === project.id;
            const liveDockInfo = isThisDragging ? activeDockingPreview : null;
            const persistedDockState = resolveProjectDockState(projectDockState, project.id);
            const renderDockState: ProjectDockState = isThisRedocking
              ? 'capturing'
              : (liveDockInfo?.dockState ?? persistedDockState);
            const isDockStateVisible = renderDockState !== 'docked';
            const isCapturingBlocked = Boolean(liveDockInfo?.dockState === 'capturing' && liveDockInfo.isBlocked);

            const isProjectConnectedToHoveredSkill = hoveredSkillId ? focusedConnectedProjectIds.has(project.id) : (selectedSkillId ? focusedConnectedProjectIds.has(project.id) : false);
            const selectedExp = selectedExperienceId ? activeExperience.find(e => e.id === selectedExperienceId) : null;
            const isLinkedToSelectedExp = selectedExp ? isProjectLinkedToExperience(project, selectedExp) : false;

            const isAnyFocus = isHoverFocus || Boolean(selectedProjectId) || Boolean(selectedSkillId) || Boolean(draggingNode);
            const emphasis = getTopologyNodeEmphasis({
              nodeType: 'project',
              mode: topologyViewMode,
              isHovered,
              isSelected,
              isDragging: isThisDragging,
              isConnectedToFocus: isProjectConnectedToHoveredSkill,
              isAnyFocusActive: isAnyFocus,
              isSelectedExpActive: Boolean(selectedExperienceId),
              isLinkedToSelectedExp,
              isSkillLinkedToExp: false
            });
            const isHighlighted = emphasis === 'highlighted';
            const emphasisClass = getNodeEmphasisClassName(emphasis);
            
            const projectPos = getProjectPos(project);
            const originX = projectPos.x;
            const originY = projectPos.y;
            const { width, depth, height } = getTopologyProjectDimensions(project);
            const levels = project.dimensions.levels;

            // Compute 3D corners for the base slab
            // Level 0 (ground)
            const p0_ground = project3DToIso(originX, originY, 0);
            const p1_ground = project3DToIso(originX + width, originY, 0);
            const p2_ground = project3DToIso(originX + width, originY + depth, 0);
            const p3_ground = project3DToIso(originX, originY + depth, 0);

            // Level Top (z = height)
            const p0_top = project3DToIso(originX, originY, height);
            const p1_top = project3DToIso(originX + width, originY, height);
            const p2_top = project3DToIso(originX + width, originY + depth, height);
            const p3_top = project3DToIso(originX, originY + depth, height);

            // Roof center for badge and beacon
            const roofCenterX = p0_top.x + (p2_top.x - p0_top.x) / 2;
            const roofCenterY = p0_top.y + (p2_top.y - p0_top.y) / 2;

            // Intermediate Level Lines for tiers
            const tierLines: React.ReactNode[] = [];
            for (let l = 1; l < levels; l++) {
              const tierZ = (height / levels) * l;
              const pLeft = project3DToIso(originX, originY + depth, tierZ);
              const pCorner = project3DToIso(originX + width, originY + depth, tierZ);
              const pRight = project3DToIso(originX + width, originY, tierZ);

              tierLines.push(
                <g key={`tier-${l}`}>
                  {/* Front face floor line */}
                  <line
                    x1={pLeft.x}
                    y1={pLeft.y}
                    x2={pCorner.x}
                    y2={pCorner.y}
                    stroke={isSelected || isHovered || isThisDragging ? '#C3E54E' : 'rgba(195, 229, 78, 0.4)'}
                    strokeWidth="1"
                  />
                  {/* Side face floor line */}
                  <line
                    x1={pCorner.x}
                    y1={pCorner.y}
                    x2={pRight.x}
                    y2={pRight.y}
                    stroke={isSelected || isHovered || isThisDragging ? '#C3E54E' : 'rgba(195, 229, 78, 0.25)'}
                    strokeWidth="1"
                  />
                  {/* Floor Level Stamp */}
                  <text
                    x={pCorner.x + 3}
                    y={pCorner.y + 3}
                    fontSize="6"
                    fill={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#8C8870'}
                    fontFamily="monospace"
                  >
                    L{l}
                  </text>
                </g>
              );
            }

            return (
              <g
                key={project.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startPos = { x: originX, y: originY };
                  const persisted = resolveProjectDockState(projectDockState, project.id);
                  setDraggingNode({
                    type: 'project',
                    id: project.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startNodePos: startPos,
                    currentPos: startPos,
                    rawPos: startPos,
                    hasMoved: false,
                    // Already-detached: no resistance phase — grabbing it again is
                    // immediately free-drag, with the gesture start itself as the
                    // free-drag baseline (see PR23 spec section 17/19).
                    crossedDetachThreshold: persisted === 'detached',
                    breakaway: persisted === 'detached'
                      ? { clientX: e.clientX, clientY: e.clientY, worldPos: startPos }
                      : undefined,
                  });
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  if (e.touches.length === 1) {
                    const startPos = { x: originX, y: originY };
                    const persisted = resolveProjectDockState(projectDockState, project.id);
                    setDraggingNode({
                      type: 'project',
                      id: project.id,
                      startClientX: e.touches[0].clientX,
                      startClientY: e.touches[0].clientY,
                      startNodePos: startPos,
                      currentPos: startPos,
                      rawPos: startPos,
                      hasMoved: false,
                      crossedDetachThreshold: persisted === 'detached',
                      breakaway: persisted === 'detached'
                        ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, worldPos: startPos }
                        : undefined,
                    });
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDrillIntoProject(project.id);
                }}
                onMouseEnter={() => setHoveredProjectId(project.id)}
                onMouseLeave={() => setHoveredProjectId(null)}
                className={`cursor-grab active:cursor-grabbing group transition-all duration-200 ${emphasisClass}`}
              >
                {/* Structure Shadow on the Drafting Plane */}
                <polygon
                  points={`${p0_ground.x},${p0_ground.y} ${p1_ground.x},${p1_ground.y} ${p2_ground.x},${p2_ground.y} ${p3_ground.x},${p3_ground.y}`}
                  fill="url(#hatch-arch)"
                  stroke="#15150F"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                />

                {/* Left/Front Face (SOLID HIGH-CONTRAST INK BLACK) */}
                <polygon
                  points={`${p3_ground.x},${p3_ground.y} ${p2_ground.x},${p2_ground.y} ${p2_top.x},${p2_top.y} ${p3_top.x},${p3_top.y}`}
                  fill={isThisDragging ? '#1A1914' : isSelected ? '#15150F' : isHovered ? '#23221B' : '#1A1914'}
                  stroke={isThisDragging || isHovered ? '#C3E54E' : '#15150F'}
                  strokeWidth={isSelected || isHovered || isThisDragging ? '2' : '1.5'}
                />

                {/* Right/Side Face (DEEP SHADED BLACK) */}
                <polygon
                  points={`${p2_ground.x},${p2_ground.y} ${p1_ground.x},${p1_ground.y} ${p1_top.x},${p1_top.y} ${p2_top.x},${p2_top.y}`}
                  fill={isThisDragging ? '#0F0E0B' : isSelected ? '#0A0A08' : isHovered ? '#181712' : '#100F0C'}
                  stroke={isThisDragging || isHovered ? '#C3E54E' : '#15150F'}
                  strokeWidth={isSelected || isHovered || isThisDragging ? '2' : '1.5'}
                />

                {/* Top Face / Roof Slab */}
                <polygon
                  points={`${p0_top.x},${p0_top.y} ${p1_top.x},${p1_top.y} ${p2_top.x},${p2_top.y} ${p3_top.x},${p3_top.y}`}
                  fill={isThisDragging ? '#26251E' : isSelected ? '#15150F' : isHovered ? '#2D2C23' : '#26251E'}
                  stroke={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#15150F'}
                  strokeWidth={isSelected || isHovered || isThisDragging ? '2.5' : '1.5'}
                />

                {/* Architectural Floor Lines & Vents */}
                {tierLines}

                {/* Active Radar Pulse Beacon on Roof Corner */}
                <g transform={`translate(${p0_top.x}, ${p0_top.y})`}>
                  <line x1="0" y1="0" x2="0" y2="-10" stroke={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#15150F'} strokeWidth="1.5" />
                  <circle cx="0" cy="-10" r="3" fill="#C3E54E" />
                  <circle cx="0" cy="-10" r="7" stroke="#C3E54E" strokeWidth="1" fill="none" opacity="0.8" className="animate-ping" />
                </g>

                {/* Subsystem Count Marker on the Roof */}
                <g transform={`translate(${roofCenterX}, ${roofCenterY})`}>
                  <rect
                    x="-20"
                    y="-7"
                    width="40"
                    height="14"
                    fill={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#15150F'}
                    stroke={isSelected || isHovered || isThisDragging ? '#15150F' : '#3E3C2F'}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="bold"
                    fill={isSelected || isHovered || isThisDragging ? '#15150F' : '#D4CDA4'}
                    fontFamily="monospace"
                  >
                    {project.subsystems.length} SUBSYS
                  </text>
                </g>

                {/* High-Contrast Brutalist Callout Box */}
                {(() => {
                  const titleLines = wrapCalloutTitle(project.title, 20, 2);
                  const isTwoLines = titleLines.length > 1;
                  const cardWidth = PROJECT_CALLOUT_WIDTH;
                  const cardHeight = isTwoLines ? PROJECT_CALLOUT_DOUBLE_HEIGHT : PROJECT_CALLOUT_SINGLE_HEIGHT;
                  const cardY = isTwoLines ? PROJECT_CALLOUT_DOUBLE_Y : PROJECT_CALLOUT_SINGLE_Y;

                  return (
                    <g transform={`translate(${p3_top.x - 8}, ${p3_top.y - 30})`}>
                      {/* Lead Line */}
                      <line
                        x1="8"
                        y1="30"
                        x2="8"
                        y2="16"
                        stroke={isHovered ? '#C3E54E' : '#15150F'}
                        strokeWidth="1.2"
                      />
                      <circle cx="8" cy="30" r="2" fill={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#15150F'} />

                      {/* Callout Card Base (SOLID BLACK) */}
                      <rect
                        x="-4"
                        y={cardY}
                        width={cardWidth}
                        height={cardHeight}
                        fill="#15150F"
                        stroke={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#15150F'}
                        strokeWidth={isSelected || isHovered || isThisDragging ? '1.8' : '1'}
                      />

                      {/* Category Accent Stripe */}
                      <rect
                        x="-4"
                        y={cardY}
                        width="3.5"
                        height={cardHeight}
                        fill={isHovered ? '#C3E54E' : project.accentColor}
                      />

                      {/* Text inside Callout */}
                      {/* Line 1: Code */}
                      <text
                        x="5"
                        y={isTwoLines ? -6 : -2}
                        fontSize="7"
                        fontWeight="bold"
                        fill="#8C8870"
                        fontFamily="monospace"
                      >
                        {project.code}
                      </text>

                      {/* Line 2: Title Line 1 */}
                      <text
                        x="5"
                        y={isTwoLines ? 3 : 7}
                        fontSize="8"
                        fontWeight="bold"
                        fill={isHovered || isThisDragging ? '#C3E54E' : '#D4CDA4'}
                        fontFamily="monospace"
                      >
                        {titleLines[0]}
                      </text>

                      {/* Line 3 (if two lines): Title Line 2 */}
                      {isTwoLines && (
                        <text
                          x="5"
                          y="12"
                          fontSize="8"
                          fontWeight="bold"
                          fill={isHovered || isThisDragging ? '#C3E54E' : '#D4CDA4'}
                          fontFamily="monospace"
                        >
                          {titleLines[1]}
                        </text>
                      )}

                      {/* Status & Year line */}
                      <text
                        x="5"
                        y={isTwoLines ? 19 : 14}
                        fontSize="6.5"
                        fill={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#8C8870'}
                        fontFamily="monospace"
                      >
                        {isHovered && focusedConnectedSkillIds.size > 0 
                          ? `${focusedConnectedSkillIds.size} ACTIVE CONDUITS` 
                          : `${project.status} · ${project.year}`}
                      </text>

                      {/* Drill-in icon button */}
                      {isSelected && (
                        <g 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDrillIntoProject(project.id);
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            x={cardWidth - 24}
                            y={cardY + 2}
                            width="18"
                            height={cardHeight - 4}
                            fill="#C3E54E"
                            stroke="#15150F"
                            strokeWidth="1"
                          />
                          <text
                            x={cardWidth - 15}
                            y={cardY + cardHeight / 2 + 3}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="bold"
                            fill="#15150F"
                          >
                            →
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })()}

                {/* PR23: Reserved orbital slot marker + tether. The slot itself
                    keeps revolving with the ring even while this project sits
                    detached — never a duplicate project cube, never another
                    orbital ellipse, just a small drafting-style diamond mark.
                    The tether only appears while actively dragging/redocking
                    (an idle detached project shows the marker alone). */}
                {isDockStateVisible && (() => {
                  const reservedSlotOrigin = animatedCanonicalProjectPositions[project.id];
                  if (!reservedSlotOrigin) return null;
                  const reservedCenterIso = getProjectVisualCenterIso(project, reservedSlotOrigin);
                  // Ground-plane center of the CURRENT rendered box — same corners
                  // already computed above for the main structure, so this always
                  // matches exactly what's on screen (resisted, free-drag, or settling).
                  const currentCenterIso = {
                    x: (p0_ground.x + p2_ground.x) / 2,
                    y: (p0_ground.y + p2_ground.y) / 2,
                  };
                  const showTether = isThisDragging || isThisRedocking;
                  const isCapturingActive = renderDockState === 'capturing' && !isCapturingBlocked;
                  const markerColor = isCapturingBlocked ? '#E5534E' : isCapturingActive ? '#C3E54E' : '#15150F';
                  const markerOpacity = isCapturingActive ? 0.9 : isCapturingBlocked ? 0.75 : 0.4;
                  const m = 6;

                  return (
                    <g className="pointer-events-none">
                      {showTether && (
                        <line
                          x1={reservedCenterIso.x}
                          y1={reservedCenterIso.y}
                          x2={currentCenterIso.x}
                          y2={currentCenterIso.y}
                          stroke={isCapturingBlocked ? '#E5534E' : isCapturingActive ? '#C3E54E' : 'rgba(21, 21, 15, 0.5)'}
                          strokeWidth={isCapturingActive ? 1.1 : 0.8}
                          strokeDasharray="3 3"
                          opacity={isCapturingActive ? 0.7 : 0.45}
                        />
                      )}
                      <path
                        d={`M ${reservedCenterIso.x} ${reservedCenterIso.y - m} L ${reservedCenterIso.x + m} ${reservedCenterIso.y} L ${reservedCenterIso.x} ${reservedCenterIso.y + m} L ${reservedCenterIso.x - m} ${reservedCenterIso.y} Z`}
                        fill="none"
                        stroke={markerColor}
                        strokeWidth={isCapturingActive ? 1.4 : 1}
                        opacity={markerOpacity}
                      />
                      <circle cx={reservedCenterIso.x} cy={reservedCenterIso.y} r={1.2} fill={markerColor} opacity={markerOpacity} />
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </g>
        </g>
      </svg>

      {/* Floating Hover Card Preview */}
      {hoveredProjectId && !selectedProjectId && !draggingNode && (
        <div 
          className="absolute top-12 left-4 z-30 w-76 bg-[#D4CDA4] border-2 border-[#15150F] p-3 pointer-events-none select-none shadow-[3px_3px_0px_#15150F] animate-in fade-in duration-150"
        >
          {(() => {
            const p = projects.find(item => item.id === hoveredProjectId);
            if (!p) return null;
            return (
              <div className="flex flex-col gap-1.5 font-mono text-[10px]">
                <div className="flex items-center justify-between border-b border-precision pb-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-2.5 h-2.5 bg-[#C3E54E] border border-[#15150F]"></span>
                    <span>{p.code} // {p.title}</span>
                  </div>
                  <span className="text-[8px] bg-[#15150F] text-[#C3E54E] px-1 py-0.5 font-bold">{p.status}</span>
                </div>
                <p className="text-[9.5px] text-[#3D3A2C] leading-tight">{p.tagline}</p>
                
                {/* Active Conduits Counter Badge */}
                <div className="flex items-center justify-between bg-[#15150F] text-[#C3E54E] px-2 py-1 text-[8.5px] font-bold">
                  <span>SIGNAL CONDUITS:</span>
                  <span className="flex items-center gap-1">
                    <Activity size={10} />
                    {focusedConnectedSkillIds.size} ACTIVE CHANNELS
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mt-0.5">
                  {p.techStack.map(t => (
                    <span 
                      key={t} 
                      className="text-[8px] border border-[#15150F] bg-[#E2DCB9] px-1 font-bold text-[#15150F]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="text-[8px] text-[#5C5946] border-t border-precision pt-1 flex justify-between font-bold">
                  <span>CLICK TO INSPECT · DRAG TO MOVE</span>
                  <span>DBL-CLICK DRILL IN →</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
