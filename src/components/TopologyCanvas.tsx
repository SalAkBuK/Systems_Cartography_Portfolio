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
  Zap,
  GitBranch
} from 'lucide-react';
import { 
  ProjectData, 
  InfrastructureSkill, 
  ExperienceNode, 
  SystemCategory, 
  ViewportState 
} from '../types';
import { VERIFIED_TOPOLOGY_ZONES as TOPOLOGY_ZONES } from '../data/verifiedPortfolioData';
import {
  VERIFIED_EXPERIENCE as EXPERIENCE_HISTORY,
  VERIFIED_PROJECTS as PROJECTS,
  VERIFIED_SKILLS as INFRASTRUCTURE_SKILLS
} from '../data/verifiedPortfolioData';
import {
  findNearestValidGridPosition,
  checkCollisions,
  GRID_SNAP_STEP
} from '../utils/collision';
import {
  createTopologyGraph,
  calculateConduitGeometry,
  stepForceSimulation,
  computeEquilibriumLayout,
  ConduitPathGeometry
} from '../utils/forceLayout';

interface TopologyCanvasProps {
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onDrillIntoProject: (id: string) => void;
  selectedSkillId: string | null;
  onSelectSkill: (id: string) => void;
  selectedExperienceId: string | null;
  onSelectExperience: (id: string) => void;
  selectedCategory: SystemCategory | 'all';
  searchQuery: string;
  traceModeActive: boolean;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  projects: ProjectData[];
  skills?: InfrastructureSkill[];
  experience?: ExperienceNode[];
}

// Math helpers for Isometric Axonometric Projection
// 30 degree axonometric angle: cos(30°) ≈ 0.8660254, sin(30°) = 0.5
const ISO_COS = 0.86602540378;
const ISO_SIN = 0.5;

export const project3DToIso = (x: number, y: number, z: number = 0): { x: number; y: number } => {
  return {
    x: (x - y) * ISO_COS,
    y: (x + y) * ISO_SIN - z,
  };
};

export const projectIsoTo3D = (isoX: number, isoY: number): { x: number; y: number } => {
  const term1 = isoX / ISO_COS;
  const term2 = isoY / ISO_SIN;
  return {
    x: 0.5 * (term1 + term2),
    y: 0.5 * (term2 - term1),
  };
};

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  selectedProjectId,
  onSelectProject,
  onDrillIntoProject,
  selectedSkillId,
  onSelectSkill,
  selectedExperienceId,
  onSelectExperience,
  selectedCategory,
  searchQuery,
  traceModeActive,
  viewport,
  setViewport,
  projects,
  skills,
  experience,
}) => {
  const activeSkills = useMemo(() => skills && skills.length > 0 ? skills : INFRASTRUCTURE_SKILLS, [skills]);
  const activeExperience = useMemo(() => experience && experience.length > 0 ? experience : EXPERIENCE_HISTORY, [experience]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredSkillId, setHoveredSkillId] = useState<string | null>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 1000, height: 700 });

  // Custom dragged positions for 3D project structures, skill nodes, and experience nodes
  const [customProjectPositions, setCustomProjectPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [customSkillPositions, setCustomSkillPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [customExpPositions, setCustomExpPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Grid snap state (enabled by default)
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [snapNotice, setSnapNotice] = useState<{ message: string; type: 'snap' | 'collision' } | null>(null);

  // Force-Directed Layout & Dynamic Physics States
  const [forceEngineActive, setForceEngineActive] = useState(true);
  const [isSimulatingEquilibrium, setIsSimulatingEquilibrium] = useState(false);
  const [simulationEnergy, setSimulationEnergy] = useState<number>(0);

  // Active node drag state with live position tracking
  const [draggingNode, setDraggingNode] = useState<{
    type: 'project' | 'skill' | 'experience';
    id: string;
    startClientX: number;
    startClientY: number;
    startNodePos: { x: number; y: number };
    currentPos: { x: number; y: number };
    hasMoved: boolean;
  } | null>(null);

  // Synchronized node position getters for 100% frame-accurate alignment
  const getProjectPos = useCallback((project: ProjectData) => {
    if (draggingNode?.type === 'project' && draggingNode.id === project.id) {
      return draggingNode.currentPos;
    }
    return customProjectPositions[project.id] || project.gridPosition;
  }, [draggingNode, customProjectPositions]);

  const getSkillPos = useCallback((skill: InfrastructureSkill) => {
    if (draggingNode?.type === 'skill' && draggingNode.id === skill.id) {
      return draggingNode.currentPos;
    }
    return customSkillPositions[skill.id] || skill.gridPosition;
  }, [draggingNode, customSkillPositions]);

  const getExpPos = useCallback((exp: ExperienceNode) => {
    if (draggingNode?.type === 'experience' && draggingNode.id === exp.id) {
      return draggingNode.currentPos;
    }
    return customExpPositions[exp.id] || exp.gridPosition;
  }, [draggingNode, customExpPositions]);

  // Check if a skill and project are connected through dependencies or tech stack matches
  const isSkillConnectedToProject = useCallback((skillId: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const skill = activeSkills.find(s => s.id === skillId);
    if (!project || !skill) return false;

    const isDep = project.infrastructureDeps.includes(skill.id);
    const isUsed = skill.usedInProjects.includes(project.id);
    const techMatch = project.techStack.some(t => {
      const firstWord = skill.name.toLowerCase().split(' ')[0];
      return t.toLowerCase().includes(firstWord) || firstWord.includes(t.toLowerCase());
    });
    return isDep || isUsed || techMatch;
  }, [projects, activeSkills]);

  // Active focus target (hovered node has top priority, followed by selected node)
  const activeFocusProjectId = hoveredProjectId || (hoveredSkillId ? null : selectedProjectId);
  const activeFocusSkillId = hoveredSkillId || (hoveredProjectId ? null : selectedSkillId);
  const isNodeFocused = Boolean(hoveredProjectId || hoveredSkillId || selectedProjectId || selectedSkillId);
  const isHoverFocus = Boolean(hoveredProjectId || hoveredSkillId);

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

  const resetAllPositions = useCallback(() => {
    setCustomProjectPositions({});
    setCustomSkillPositions({});
    setCustomExpPositions({});
    setSnapNotice({ message: 'TOPOLOGY POSITIONS RESET TO DEFAULT', type: 'snap' });
    setTimeout(() => setSnapNotice(null), 2400);
  }, []);

  // Animated Auto-Equilibrium Constraint Solver
  const runAutoEquilibrium = useCallback(() => {
    if (isSimulatingEquilibrium) return;
    setIsSimulatingEquilibrium(true);
    setSnapNotice({ message: 'CONSTRAINT SOLVER // HARMONIZING CONDUIT FORCES', type: 'snap' });

    const { nodes, edges } = createTopologyGraph(
      projects,
      activeSkills,
      activeExperience,
      customProjectPositions,
      customSkillPositions,
      customExpPositions
    );

    let frame = 0;
    const maxFrames = 50;

    const animStep = () => {
      frame++;
      const { maxVelocity, totalKineticEnergy } = stepForceSimulation(nodes, edges, {
        damping: 0.82,
        repulsionStrength: 4800,
        springStrengthMultiplier: 1.25,
        zoneGravityStrength: 0.015,
        resolveCollisions: true
      });

      setSimulationEnergy(totalKineticEnergy);

      const nextProjects: Record<string, { x: number; y: number }> = {};
      const nextSkills: Record<string, { x: number; y: number }> = {};
      const nextExps: Record<string, { x: number; y: number }> = {};

      nodes.forEach(node => {
        const rounded = { x: Math.round(node.x), y: Math.round(node.y) };
        if (node.type === 'project') nextProjects[node.id] = rounded;
        else if (node.type === 'skill') nextSkills[node.id] = rounded;
        else if (node.type === 'experience') nextExps[node.id] = rounded;
      });

      setCustomProjectPositions(nextProjects);
      setCustomSkillPositions(nextSkills);
      setCustomExpPositions(nextExps);

      if (frame < maxFrames && maxVelocity > 0.35) {
        requestAnimationFrame(animStep);
      } else {
        setIsSimulatingEquilibrium(false);
        setSnapNotice({ message: 'TOPOLOGY EQUILIBRIUM ACHIEVED // ZERO OVERLAP', type: 'snap' });
        setTimeout(() => setSnapNotice(null), 2200);
      }
    };

    requestAnimationFrame(animStep);
  }, [isSimulatingEquilibrium, projects, activeSkills, activeExperience, customProjectPositions, customSkillPositions, customExpPositions]);

  const hasCustomPositions = useMemo(() => {
    return Object.keys(customProjectPositions).length > 0 ||
      Object.keys(customSkillPositions).length > 0 ||
      Object.keys(customExpPositions).length > 0;
  }, [customProjectPositions, customSkillPositions, customExpPositions]);

  // Real-time preview calculation of snapped & collision-free landing spot
  const dragResolution = useMemo(() => {
    if (!draggingNode || !draggingNode.hasMoved) return null;
    return findNearestValidGridPosition(
      draggingNode.type,
      draggingNode.id,
      draggingNode.currentPos,
      customProjectPositions,
      customSkillPositions,
      customExpPositions,
      projects,
      activeSkills,
      activeExperience,
      GRID_SNAP_STEP,
      gridSnapEnabled
    );
  }, [draggingNode, customProjectPositions, customSkillPositions, customExpPositions, projects, activeSkills, activeExperience, gridSnapEnabled]);

  // Real-time raw collision warning if directly hovering over another node
  const liveCollision = useMemo(() => {
    if (!draggingNode || !draggingNode.hasMoved) return null;
    return checkCollisions(
      draggingNode.type,
      draggingNode.id,
      draggingNode.currentPos,
      customProjectPositions,
      customSkillPositions,
      customExpPositions,
      projects,
      activeSkills,
      activeExperience
    );
  }, [draggingNode, customProjectPositions, customSkillPositions, customExpPositions, projects, activeSkills, activeExperience]);

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

  // Auto-fit function to center and fit all topology nodes
  const fitAll = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth || 800;
    const h = containerRef.current.clientHeight || 600;
    // Bounding box fits safely across all desktop & mobile screen sizes
    const fitZoom = Math.min(Math.max(Math.min(w / 640, h / 460) * 0.95, 0.55), 1.2);
    setViewport({ x: 0, y: 10, zoom: Number(fitZoom.toFixed(2)) });
  }, [setViewport]);

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

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = searchQuery === '' || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [projects, selectedCategory, searchQuery]);

  // Global window mousemove & mouseup listeners for buttery smooth dragging with snap collision resolution
  useEffect(() => {
    if (!draggingNode) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const deltaScreenX = (e.clientX - draggingNode.startClientX) / viewport.zoom;
      const deltaScreenY = (e.clientY - draggingNode.startClientY) / viewport.zoom;
      
      const moved = Math.hypot(deltaScreenX, deltaScreenY) > 3;

      const delta3D = projectIsoTo3D(deltaScreenX, deltaScreenY);
      const newPos = {
        x: Math.round(draggingNode.startNodePos.x + delta3D.x),
        y: Math.round(draggingNode.startNodePos.y + delta3D.y),
      };

      setDraggingNode(prev => prev ? {
        ...prev,
        currentPos: newPos,
        hasMoved: prev.hasMoved || moved,
      } : null);

      if (draggingNode.type === 'project') {
        setCustomProjectPositions(prev => ({ ...prev, [draggingNode.id]: newPos }));
      } else if (draggingNode.type === 'skill') {
        setCustomSkillPositions(prev => ({ ...prev, [draggingNode.id]: newPos }));
      } else if (draggingNode.type === 'experience') {
        setCustomExpPositions(prev => ({ ...prev, [draggingNode.id]: newPos }));
      }
    };

    const handleWindowMouseUp = () => {
      if (draggingNode) {
        if (!draggingNode.hasMoved) {
          if (draggingNode.type === 'project') {
            onSelectProject(draggingNode.id);
          } else if (draggingNode.type === 'skill') {
            onSelectSkill(draggingNode.id);
          } else if (draggingNode.type === 'experience') {
            onSelectExperience(draggingNode.id);
          }
        } else {
          // Resolve snap & collision avoidance on drop
          const resolved = findNearestValidGridPosition(
            draggingNode.type,
            draggingNode.id,
            draggingNode.currentPos,
            customProjectPositions,
            customSkillPositions,
            customExpPositions,
            projects,
            activeSkills,
            activeExperience,
            GRID_SNAP_STEP,
            gridSnapEnabled
          );

          const finalPos = { x: resolved.x, y: resolved.y };

          if (draggingNode.type === 'project') {
            setCustomProjectPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
          } else if (draggingNode.type === 'skill') {
            setCustomSkillPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
          } else if (draggingNode.type === 'experience') {
            setCustomExpPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
          }

          if (resolved.wasAdjusted) {
            setSnapNotice({
              message: `AUTO-ALIGNED // PREVENTED OVERLAP WITH ${resolved.collidingWith || 'ADJACENT NODE'}`,
              type: 'collision',
            });
            setTimeout(() => setSnapNotice(null), 2500);
          } else if (gridSnapEnabled) {
            setSnapNotice({
              message: `SNAPPED TO GRID [X:${finalPos.x}, Y:${finalPos.y}]`,
              type: 'snap',
            });
            setTimeout(() => setSnapNotice(null), 1800);
          }
        }
        setDraggingNode(null);
      }
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !draggingNode) return;
      const touch = e.touches[0];
      const deltaScreenX = (touch.clientX - draggingNode.startClientX) / viewport.zoom;
      const deltaScreenY = (touch.clientY - draggingNode.startClientY) / viewport.zoom;
      
      const moved = Math.hypot(deltaScreenX, deltaScreenY) > 4;

      const delta3D = projectIsoTo3D(deltaScreenX, deltaScreenY);
      const newPos = {
        x: Math.round(draggingNode.startNodePos.x + delta3D.x),
        y: Math.round(draggingNode.startNodePos.y + delta3D.y),
      };

      setDraggingNode(prev => prev ? {
        ...prev,
        currentPos: newPos,
        hasMoved: prev.hasMoved || moved,
      } : null);

      if (draggingNode.type === 'project') {
        setCustomProjectPositions(prev => ({ ...prev, [draggingNode.id]: newPos }));
      } else if (draggingNode.type === 'skill') {
        setCustomSkillPositions(prev => ({ ...prev, [draggingNode.id]: newPos }));
      } else if (draggingNode.type === 'experience') {
        setCustomExpPositions(prev => ({ ...prev, [draggingNode.id]: newPos }));
      }
    };

    const handleWindowTouchEnd = () => {
      if (draggingNode) {
        if (!draggingNode.hasMoved) {
          if (draggingNode.type === 'project') {
            onSelectProject(draggingNode.id);
          } else if (draggingNode.type === 'skill') {
            onSelectSkill(draggingNode.id);
          } else if (draggingNode.type === 'experience') {
            onSelectExperience(draggingNode.id);
          }
        } else {
          // Resolve snap & collision avoidance on drop
          const resolved = findNearestValidGridPosition(
            draggingNode.type,
            draggingNode.id,
            draggingNode.currentPos,
            customProjectPositions,
            customSkillPositions,
            customExpPositions,
            projects,
            activeSkills,
            activeExperience,
            GRID_SNAP_STEP,
            gridSnapEnabled
          );

          const finalPos = { x: resolved.x, y: resolved.y };

          if (draggingNode.type === 'project') {
            setCustomProjectPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
          } else if (draggingNode.type === 'skill') {
            setCustomSkillPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
          } else if (draggingNode.type === 'experience') {
            setCustomExpPositions(prev => ({ ...prev, [draggingNode.id]: finalPos }));
          }

          if (resolved.wasAdjusted) {
            setSnapNotice({
              message: `AUTO-ALIGNED // PREVENTED OVERLAP WITH ${resolved.collidingWith || 'ADJACENT NODE'}`,
              type: 'collision',
            });
            setTimeout(() => setSnapNotice(null), 2500);
          } else if (gridSnapEnabled) {
            setSnapNotice({
              message: `SNAPPED TO GRID [X:${finalPos.x}, Y:${finalPos.y}]`,
              type: 'snap',
            });
            setTimeout(() => setSnapNotice(null), 1800);
          }
        }
        setDraggingNode(null);
      }
    };

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
  }, [draggingNode, viewport.zoom, customProjectPositions, customSkillPositions, customExpPositions, gridSnapEnabled, onSelectProject, onSelectSkill, onSelectExperience]);

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

    projects.forEach(project => {
      const isProjectSelected = selectedProjectId === project.id;
      const isProjectHovered = hoveredProjectId === project.id;
      const isDraggingThisProj = draggingNode?.type === 'project' && draggingNode.id === project.id;
      const projectPos = getProjectPos(project);
      
      const pWidth = (project.dimensions?.width || 100) * 0.75;
      const pDepth = 55;

      activeSkills.forEach(skill => {
        // Check if project and skill are connected
        const isDep = project.infrastructureDeps.includes(skill.id);
        const isUsed = skill.usedInProjects.includes(project.id);
        const techMatch = project.techStack.some(t => {
          const firstWord = skill.name.toLowerCase().split(' ')[0];
          return t.toLowerCase().includes(firstWord) || firstWord.includes(t.toLowerCase());
        });

        if (!isDep && !isUsed && !techMatch) return;

        const pairKey = `${project.id}-${skill.id}`;
        if (connectedPairs.has(pairKey)) return;
        connectedPairs.add(pairKey);

        const isSkillSelected = selectedSkillId === skill.id;
        const isSkillHovered = hoveredSkillId === skill.id;
        const isDraggingThisSkill = draggingNode?.type === 'skill' && draggingNode.id === skill.id;

        // Determine if this specific conduit is actively hovered / selected
        const isDirectHoverConduit = isProjectHovered || isSkillHovered;
        const isDirectSelectionConduit = (isProjectSelected && !hoveredProjectId && !hoveredSkillId) || 
                                         (isSkillSelected && !hoveredProjectId && !hoveredSkillId);
        
        const isConduitActive = isDirectHoverConduit || isDirectSelectionConduit || isDraggingThisProj || isDraggingThisSkill || (traceModeActive && !isHoverFocus);
        const isConduitDimmed = isHoverFocus && !isDirectHoverConduit;

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

        connections.push(
          <g 
            key={pairKey} 
            className={`transition-opacity duration-200 ${
              isConduitDimmed ? 'opacity-10' : isConduitActive ? 'opacity-100' : 'opacity-70'
            }`}
          >
            {/* Outer Glow Halo for Active Signal Conduits */}
            {isConduitActive && (
              <path
                d={pathData}
                fill="none"
                stroke="#C3E54E"
                strokeWidth={isDirectHoverConduit ? 5 : 3.5}
                strokeOpacity={isDirectHoverConduit ? 0.75 : 0.4}
                strokeLinecap="round"
                className="transition-all duration-150"
              />
            )}

            {/* Background trace line */}
            <path
              d={pathData}
              fill="none"
              stroke={isConduitActive ? '#15150F' : 'rgba(21, 21, 15, 0.22)'}
              strokeWidth={isConduitActive ? (isDirectHoverConduit ? 3 : 2.2) : 1}
              strokeDasharray={isConduitActive ? 'none' : '4 4'}
              className="transition-colors duration-150"
            />

            {/* Elastic spring tension halo if being actively dragged */}
            {(isDraggingThisProj || isDraggingThisSkill) && (
              <path
                d={pathData}
                fill="none"
                stroke={tension > 0.45 ? '#FF7B72' : '#C3E54E'}
                strokeWidth={4}
                strokeOpacity={0.7}
                strokeLinecap="round"
              />
            )}

            {/* High-speed animated signal pulse if active */}
            {isConduitActive && (
              <path
                d={pathData}
                fill="none"
                stroke={isDirectHoverConduit ? '#15150F' : '#C3E54E'}
                strokeWidth={isDirectHoverConduit ? 2.5 : 1.8}
                className={isDirectHoverConduit ? 'signal-conduit-fast' : 'signal-conduit'}
              />
            )}

            {/* Anchor Port at Project Foundation */}
            <circle
              cx={startIso.x}
              cy={startIso.y}
              r={isConduitActive ? 3.5 : 1.8}
              fill={isConduitActive ? '#C3E54E' : '#15150F'}
              stroke="#15150F"
              strokeWidth={isConduitActive ? 1.2 : 0.8}
            />

            {/* Junction dot at midpoint with optional hover tag */}
            <g>
              {isDirectHoverConduit && (
                <circle
                  cx={midIso.x}
                  cy={midIso.y}
                  r="7"
                  fill="none"
                  stroke="#C3E54E"
                  strokeWidth="1"
                  className="animate-ping"
                  opacity="0.8"
                />
              )}
              <circle
                cx={midIso.x}
                cy={midIso.y}
                r={isConduitActive ? 4 : 2}
                fill={isConduitActive ? (tension > 0.5 ? '#FF7B72' : '#C3E54E') : '#15150F'}
                stroke="#15150F"
                strokeWidth={isConduitActive ? 1.2 : 0.9}
              />
              {isDirectHoverConduit && (
                <g transform={`translate(${midIso.x + 8}, ${midIso.y - 6})`}>
                  <rect
                    x="-2"
                    y="-8"
                    width={skill.name.split(' ')[0].length * 6 + 14}
                    height="13"
                    fill="#15150F"
                    stroke="#C3E54E"
                    strokeWidth="0.8"
                  />
                  <text
                    x="5"
                    y="1.5"
                    fontSize="6.5"
                    fontWeight="bold"
                    fill="#C3E54E"
                    fontFamily="monospace"
                  >
                    {skill.name.split(' ')[0].toUpperCase()}
                  </text>
                </g>
              )}
            </g>

            {/* Anchor Port at Skill Plinth */}
            <circle
              cx={endIso.x}
              cy={endIso.y}
              r={isConduitActive ? 3.5 : 1.8}
              fill={isConduitActive ? '#C3E54E' : '#15150F'}
              stroke="#15150F"
              strokeWidth={isConduitActive ? 1.2 : 0.8}
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
    traceModeActive,
    isHoverFocus,
    projects,
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
      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-1.5 text-[9px] font-mono text-[#15150F] z-10 bg-[#D4CDA4]/90 px-2 py-1 border border-[#15150F] border-l-2 border-b-2">
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

      <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-2 text-[9px] font-mono text-[#15150F] z-10">
        <div className="bg-[#D4CDA4]/90 px-2 py-1 border border-[#15150F] border-l-2 border-t-2">
          <span className="font-bold">INFRASTRUCTURE SERVICES // DATA BACKBONE</span>
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
        <button
          onClick={() => setForceEngineActive(prev => !prev)}
          className={`pointer-events-auto px-2 py-1 border border-[#15150F] text-[8.5px] font-bold flex items-center gap-1 transition-colors ${
            forceEngineActive ? 'bg-[#C3E54E] text-[#15150F]' : 'bg-[#15150F] text-[#9E997F]'
          }`}
          title="Toggle Force-Directed Physics & Dynamic Conduit Spring Simulation"
        >
          <Zap size={10} />
          <span>PHYSICS ENGINE: {forceEngineActive ? 'ACTIVE' : 'STATIC'}</span>
        </button>
        {hasCustomPositions && (
          <div className="bg-[#15150F] text-[#C3E54E] px-2 py-1 border border-[#15150F] text-[8.5px] font-bold flex items-center gap-1">
            <Move size={10} />
            <span>CUSTOM LAYOUT ACTIVE</span>
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 pointer-events-none flex items-center gap-2 text-[9px] font-mono text-[#15150F] z-10 bg-[#D4CDA4]/90 px-2.5 py-1 border border-[#15150F]">
        <span>X: {viewport.x} Y: {viewport.y}</span>
        <span className="text-[#5C5946]">|</span>
        <span>SCALE: {viewport.zoom.toFixed(2)}x</span>
        <span className="text-[#5C5946]">|</span>
        <span className={forceEngineActive ? 'text-[#15150F] font-bold bg-[#C3E54E] px-1' : 'text-[#7A755D]'}>
          FORCE: {forceEngineActive ? (simulationEnergy > 0.5 ? `SPRING [${simulationEnergy.toFixed(1)} eV]` : 'EQUILIBRIUM') : 'MANUAL'}
        </span>
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
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            runAutoEquilibrium();
          }}
          disabled={isSimulatingEquilibrium}
          className="px-2 h-8 bg-[#15150F] border border-[#15150F] flex items-center justify-center gap-1 text-[#C3E54E] font-mono text-[9px] font-bold hover:bg-[#25241B] hover:text-[#D5F06E] transition-colors shadow-[2px_2px_0px_#15150F] disabled:opacity-50"
          title="Auto-Equilibrium Harmonic Relaxation (Force-Directed Graph Solver)"
        >
          <Sparkles size={12} className={isSimulatingEquilibrium ? 'animate-spin' : ''} />
          <span>{isSimulatingEquilibrium ? 'SOLVING...' : 'HARMONIZE'}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setForceEngineActive(prev => {
              const next = !prev;
              setSnapNotice({
                message: next ? 'PHYSICS SPRING ENGINE: ENGAGED' : 'PHYSICS ENGINE: STATIC',
                type: 'snap'
              });
              setTimeout(() => setSnapNotice(null), 1800);
              return next;
            });
          }}
          className={`w-8 h-8 border border-[#15150F] flex items-center justify-center transition-colors shadow-[2px_2px_0px_#15150F] ${
            forceEngineActive ? 'bg-[#C3E54E] text-[#15150F]' : 'bg-[#15150F] text-[#9E997F] hover:text-[#D4CDA4]'
          }`}
          title="Toggle Dynamic Spring Simulation"
        >
          <Zap size={13} />
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
          className={`w-8 h-8 border border-[#15150F] flex items-center justify-center transition-colors shadow-[2px_2px_0px_#15150F] ${
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
            className="px-2 h-8 bg-[#15150F] border border-[#15150F] flex items-center justify-center gap-1 text-[#D4CDA4] font-mono text-[9px] font-bold hover:text-[#C3E54E] hover:bg-[#25241B] transition-colors shadow-[2px_2px_0px_#15150F]"
            title="Reset Nodes to Default Schematic (Alt+R)"
          >
            <RotateCcw size={12} />
            <span>RESET</span>
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.2, 2.5) }));
          }}
          className="w-8 h-8 bg-[#15150F] border border-[#15150F] flex items-center justify-center text-[#D4CDA4] hover:text-[#C3E54E] hover:bg-[#25241B] transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.2, 0.45) }));
          }}
          className="w-8 h-8 bg-[#15150F] border border-[#15150F] flex items-center justify-center text-[#D4CDA4] hover:text-[#C3E54E] hover:bg-[#25241B] transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            fitAll();
          }}
          className="px-2 h-8 bg-[#C3E54E] border border-[#15150F] flex items-center justify-center gap-1 text-[#15150F] font-mono text-[9px] font-bold hover:bg-[#D5F06E] transition-colors shadow-[2px_2px_0px_#15150F]"
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
            
            // Dim if hover focus is active and this skill is NOT hovered and NOT connected to hovered project
            const isDimmed = isHoverFocus && !isHovered && !isSkillConnected;
            const isHighlighted = isHovered || isSelected || isSkillConnected || isThisDragging;

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
                className={`cursor-grab active:cursor-grabbing group transition-all duration-200 ${
                  isDimmed ? 'opacity-20 grayscale pointer-events-auto' : 'opacity-100'
                }`}
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

                {/* Inner architectural hatch ring */}
                <circle
                  cx={posIso.x}
                  cy={posIso.y}
                  r="9"
                  fill={isSelected ? '#C3E54E' : isSkillConnected ? '#15150F' : '#15150F'}
                />
                <circle
                  cx={posIso.x}
                  cy={posIso.y}
                  r="4"
                  fill={isSelected ? '#15150F' : isSkillConnected ? '#C3E54E' : '#D4CDA4'}
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
                  {skill.name.split(' ')[0]}
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

        {/* Experience Timeline Nodes - Draggable */}
        <g id="experience-history-nodes">
          {activeExperience.map((exp, idx) => {
            const isSelected = selectedExperienceId === exp.id;
            const isThisDragging = draggingNode?.type === 'experience' && draggingNode.id === exp.id;
            const isDimmed = isHoverFocus;
            const expPos = getExpPos(exp);
            const posIso = project3DToIso(expPos.x, expPos.y, 0);

            const nextExp = activeExperience[idx + 1];
            const nextPos = nextExp ? getExpPos(nextExp) : null;
            const nextIso = nextPos ? project3DToIso(nextPos.x, nextPos.y, 0) : null;

            return (
              <g
                key={exp.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingNode({
                    type: 'experience',
                    id: exp.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startNodePos: { ...expPos },
                    currentPos: { ...expPos },
                    hasMoved: false,
                  });
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  if (e.touches.length === 1) {
                    setDraggingNode({
                      type: 'experience',
                      id: exp.id,
                      startClientX: e.touches[0].clientX,
                      startClientY: e.touches[0].clientY,
                      startNodePos: { ...expPos },
                      currentPos: { ...expPos },
                      hasMoved: false,
                    });
                  }
                }}
                className={`cursor-grab active:cursor-grabbing group transition-all duration-200 ${
                  isDimmed ? 'opacity-20 grayscale pointer-events-auto' : 'opacity-100'
                }`}
              >
                {/* Timeline connector line to next node */}
                {nextIso && (
                  <line
                    x1={posIso.x}
                    y1={posIso.y}
                    x2={nextIso.x}
                    y2={nextIso.y}
                    stroke="#15150F"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Stepper square */}
                <rect
                  x={posIso.x - 12}
                  y={posIso.y - 12}
                  width="24"
                  height="24"
                  fill={isThisDragging ? '#C3E54E' : isSelected ? '#15150F' : '#D4CDA4'}
                  stroke="#15150F"
                  strokeWidth={isSelected || isThisDragging ? '2' : '1'}
                />
                <text
                  x={posIso.x}
                  y={posIso.y + 3}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="bold"
                  fill={isSelected ? '#C3E54E' : '#15150F'}
                  fontFamily="monospace"
                >
                  {exp.code.replace('BUILD-', 'B')}
                </text>

                {/* Role and Year Annotation */}
                <text
                  x={posIso.x}
                  y={posIso.y - 16}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="bold"
                  fill="#15150F"
                  fontFamily="monospace"
                >
                  {exp.yearRange.split(' ')[0]}
                </text>
                <text
                  x={posIso.x}
                  y={posIso.y + 24}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#5C5946"
                  fontFamily="monospace"
                >
                  {exp.organization}
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
                const w = (proj?.dimensions.width || 100) * 0.75;
                const d = 55;

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
            const isProjectConnectedToHoveredSkill = hoveredSkillId ? focusedConnectedProjectIds.has(project.id) : false;

            // Dim if hover focus is active and this project is NOT hovered and NOT connected to hovered skill
            const isDimmed = isHoverFocus && !isHovered && !isProjectConnectedToHoveredSkill;
            const isHighlighted = isHovered || isSelected || isProjectConnectedToHoveredSkill || isThisDragging;
            
            const projectPos = getProjectPos(project);
            const originX = projectPos.x;
            const originY = projectPos.y;
            const width = project.dimensions.width * 0.75;
            const depth = 55;
            const height = project.dimensions.height * 0.75;
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
                  setDraggingNode({
                    type: 'project',
                    id: project.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startNodePos: { x: originX, y: originY },
                    currentPos: { x: originX, y: originY },
                    hasMoved: false,
                  });
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  if (e.touches.length === 1) {
                    setDraggingNode({
                      type: 'project',
                      id: project.id,
                      startClientX: e.touches[0].clientX,
                      startClientY: e.touches[0].clientY,
                      startNodePos: { x: originX, y: originY },
                      currentPos: { x: originX, y: originY },
                      hasMoved: false,
                    });
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDrillIntoProject(project.id);
                }}
                onMouseEnter={() => setHoveredProjectId(project.id)}
                onMouseLeave={() => setHoveredProjectId(null)}
                className={`cursor-grab active:cursor-grabbing group transition-all duration-200 ${
                  isDimmed ? 'opacity-20 grayscale pointer-events-auto' : isThisDragging ? 'opacity-90' : 'opacity-100'
                }`}
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
                    y="-12"
                    width="122"
                    height="28"
                    fill="#15150F"
                    stroke={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#15150F'}
                    strokeWidth={isSelected || isHovered || isThisDragging ? '1.8' : '1'}
                  />

                  {/* Category Accent Stripe */}
                  <rect
                    x="-4"
                    y="-12"
                    width="3.5"
                    height="28"
                    fill={isHovered ? '#C3E54E' : project.accentColor}
                  />

                  {/* Text inside Callout */}
                  <text
                    x="5"
                    y="-1"
                    fontSize="8.5"
                    fontWeight="bold"
                    fill={isHovered || isThisDragging ? '#C3E54E' : '#D4CDA4'}
                    fontFamily="monospace"
                  >
                    {project.code} // {project.title}
                  </text>
                  <text
                    x="5"
                    y="10"
                    fontSize="7"
                    fill={isSelected || isHovered || isThisDragging ? '#C3E54E' : '#9E997F'}
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
                        x="98"
                        y="-10"
                        width="16"
                        height="24"
                        fill="#C3E54E"
                        stroke="#15150F"
                        strokeWidth="1"
                      />
                      <text
                        x="106"
                        y="6"
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
            const p = PROJECTS.find(item => item.id === hoveredProjectId);
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
                    <Zap size={10} />
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
