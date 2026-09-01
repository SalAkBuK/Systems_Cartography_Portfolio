/**
 * SYSTEMS CARTOGRAPHY // FLAGSHIP SYSTEMS CONFIGURATOR
 *
 * Local-only interactive setup utility for configuring owner flagship projects.
 * Run with: `npm run setup:flagships`
 *
 * Binds strictly to 127.0.0.1 (localhost). Never exposed on public networks or in production builds.
 */

import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { GITHUB_SNAPSHOT } from '../src/data/githubSnapshot.generated';
import { OWNER_PORTFOLIO_PREFERENCES } from '../src/config/ownerPreferences';
import { writeOwnerPreferences } from '../src/utils/ownerPreferencesStorage';

export const DEFAULT_CONFIGURATOR_PORT = 4174;
export const DEFAULT_CONFIGURATOR_HOST = '127.0.0.1';
const PREFERENCES_PATH = path.resolve(process.cwd(), 'src/config/ownerPreferences.ts');

interface ProjectSummary {
  id: string;
  code: string;
  title: string;
  year: string;
  status: string;
  category: string;
  techStack: string[];
  githubUrl?: string;
  summary: string;
}

function getProjectsSummary(): ProjectSummary[] {
  return (GITHUB_SNAPSHOT.projects || []).map(p => ({
    id: p.id,
    code: p.code,
    title: p.title,
    year: p.year,
    status: p.status,
    category: p.category,
    techStack: (p.techStack || []).slice(0, 5),
    githubUrl: p.links?.github,
    summary: p.summary || p.tagline || ''
  }));
}

function getProjectTitleMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of GITHUB_SNAPSHOT.projects || []) {
    map[p.id] = p.title;
  }
  return map;
}

function renderHtmlPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Systems Cartography // Flagship Configurator</title>
  <style>
    :root {
      --bg: #DCD6B2;
      --bg-darker: #CBC59B;
      --bg-card: #E2DCB9;
      --bg-active: #D4CDA4;
      --text: #15150F;
      --text-muted: #5C5946;
      --border: #15150F;
      --accent: #C3E54E;
      --danger: #E5534E;
      --success: #2E6B3A;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      line-height: 1.4;
      padding: 24px 16px;
      user-select: none;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: var(--bg);
      border: 2px solid var(--border);
      box-shadow: 8px 8px 0px var(--border);
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--bg-darker);
      border-bottom: 2px solid var(--border);
      padding: 16px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .brand h1 {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .brand p {
      font-size: 11px;
      color: var(--text-muted);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn {
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 14px;
      border: 1px solid var(--border);
      background: var(--text);
      color: var(--bg);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      text-transform: uppercase;
    }
    .btn:hover {
      background: var(--accent);
      color: var(--text);
    }
    .btn-save {
      background: var(--accent);
      color: var(--text);
      border: 1.5px solid var(--border);
      font-size: 12px;
      padding: 8px 18px;
    }
    .btn-save:hover {
      background: var(--text);
      color: var(--accent);
    }
    .btn-sm {
      padding: 3px 8px;
      font-size: 10px;
    }
    .btn-remove {
      background: var(--bg-card);
      color: var(--danger);
      border-color: var(--border);
    }
    .btn-remove:hover {
      background: var(--danger);
      color: #FFF;
    }
    .status-banner {
      padding: 10px 20px;
      font-size: 11px;
      font-weight: 700;
      display: none;
      border-bottom: 1px solid var(--border);
    }
    .status-banner.success {
      display: block;
      background: var(--accent);
      color: var(--text);
    }
    .status-banner.error {
      display: block;
      background: var(--danger);
      color: #FFF;
    }
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 600px;
    }
    @media (max-width: 840px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }
    .panel {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .panel:first-child {
      border-right: 2px solid var(--border);
    }
    @media (max-width: 840px) {
      .panel:first-child {
        border-right: none;
        border-bottom: 2px solid var(--border);
      }
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1.5px solid var(--border);
      padding-bottom: 8px;
    }
    .panel-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      background: var(--text);
      color: var(--bg);
    }
    .badge-accent {
      background: var(--text);
      color: var(--accent);
    }
    .search-box {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      font-family: inherit;
      font-size: 11px;
      color: var(--text);
      outline: none;
    }
    .search-box:focus {
      border-color: var(--border);
      background: #FFF;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      max-height: 520px;
      padding-right: 4px;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      cursor: grab;
      transition: transform 0.1s ease, border-color 0.1s ease, background 0.1s ease;
    }
    .card:active {
      cursor: grabbing;
    }
    .card.dragging {
      opacity: 0.4;
      border-style: dashed;
    }
    .card.drag-over {
      border-top: 3px solid var(--accent);
      background: var(--bg-active);
    }
    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .card-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .rank-badge {
      font-size: 11px;
      font-weight: 800;
      background: var(--text);
      color: var(--accent);
      padding: 2px 6px;
      min-width: 26px;
      text-align: center;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
    }
    .card-id {
      font-size: 10px;
      color: var(--text-muted);
    }
    .card-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 10px;
    }
    .tag {
      background: var(--bg-active);
      padding: 1px 5px;
      border: 1px solid rgba(21, 21, 15, 0.2);
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .empty-slot {
      border: 1px dashed var(--text-muted);
      background: rgba(21, 21, 15, 0.03);
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 11px;
    }
    .drop-target-active {
      border-color: var(--accent);
      background: rgba(195, 229, 78, 0.15);
    }
    footer {
      background: var(--bg-darker);
      border-top: 2px solid var(--border);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>SYSTEMS CARTOGRAPHY // FLAGSHIP CONFIGURATOR</h1>
        <p>OWNER SETUP UTILITY � SELECT & DRAG UP TO 4 KEY ARCHITECTURAL FLAGSHIP SYSTEMS</p>
      </div>
      <div class="header-actions">
        <button id="saveBtn" class="btn btn-save" onclick="saveFlagships()">SAVE FLAGSHIPS</button>
      </div>
    </header>

    <div id="statusBanner" class="status-banner"></div>

    <div class="main-grid">
      <!-- Left: Available Projects -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">AVAILABLE REPOSITORIES</span>
          <span id="availableCount" class="badge">0</span>
        </div>
        <input
          type="text"
          id="searchInput"
          class="search-box"
          placeholder="Filter by title, code, or ID..."
          oninput="handleSearch()"
        />
        <div id="availableList" class="list" ondragover="handleDragOver(event)" ondrop="handleDropToAvailable(event)"></div>
      </div>

      <!-- Right: Selected Flagships -->
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">SELECTED FLAGSHIPS (MAX 4)</span>
          <span id="selectedBadge" class="badge badge-accent">0 / 4</span>
        </div>
        <div id="selectedList" class="list" ondragover="handleDragOver(event)" ondrop="handleDropToSelected(event)"></div>
      </div>
    </div>

    <footer>
      <span>PERSISTENT TARGET: <code>src/config/ownerPreferences.ts</code></span>
      <span id="saveSummary">UNSAVED CHANGES</span>
    </footer>
  </div>

  <script>
    let allProjects = [];
    let selectedIds = [];
    let draggedId = null;
    let dragSource = null; // 'available' | 'selected'
    let searchQuery = '';

    async function init() {
      try {
        const res = await fetch('/api/state');
        const data = await res.json();
        allProjects = data.projects || [];
        selectedIds = data.selectedIds || [];
        render();
      } catch (err) {
        showStatus('Failed to load project state: ' + err.message, 'error');
      }
    }

    function render() {
      renderAvailable();
      renderSelected();
    }

    function renderAvailable() {
      const container = document.getElementById('availableList');
      const filtered = allProjects.filter(p => {
        if (selectedIds.includes(p.id)) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.title.toLowerCase().includes(q) ||
               p.code.toLowerCase().includes(q) ||
               p.id.toLowerCase().includes(q);
      });

      document.getElementById('availableCount').innerText = filtered.length;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-slot">No available repositories match filter.</div>';
        return;
      }

      container.innerHTML = filtered.map(p => {
        const canAdd = selectedIds.length < 4;
        return \`
          <div
            class="card"
            draggable="true"
            ondragstart="handleDragStart(event, \${inlineJsString(p.id)}, 'available')"
            ondragend="handleDragEnd(event)"
          >
            <div class="card-top">
              <div class="card-title-group">
                <span class="badge">\${escapeHtml(p.code)}</span>
                <span class="card-title">\${escapeHtml(p.title)}</span>
              </div>
              <button
                class="btn btn-sm"
                onclick="addFlagship(\${inlineJsString(p.id)})"
                \${canAdd ? '' : 'disabled style=\"opacity: 0.5; cursor: not-allowed;\"'}
              >
                + ADD
              </button>
            </div>
            <div class="card-meta">
              <span class="card-id">\${escapeHtml(p.id)}</span>
              <span class="tag">\${escapeHtml(p.category)}</span>
              <span class="tag">\${escapeHtml(p.status)}</span>
              <span class="tag">\${escapeHtml(p.year)}</span>
              \${p.techStack.map(t => \`<span class="tag">\${escapeHtml(t)}</span>\`).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderSelected() {
      const container = document.getElementById('selectedList');
      document.getElementById('selectedBadge').innerText = \`\${selectedIds.length} / 4\`;

      if (selectedIds.length === 0) {
        container.innerHTML = '<div class="empty-slot">No flagships selected. Drag or click + ADD from the left panel.</div>';
        return;
      }

      const projectMap = new Map(allProjects.map(p => [p.id, p]));

      container.innerHTML = selectedIds.map((id, index) => {
        const p = projectMap.get(id) || { id, code: 'GH-??', title: 'Unknown Project (' + id + ')', category: 'unknown', status: 'UNKNOWN', year: '', techStack: [] };
        const isFirst = index === 0;
        const isLast = index === selectedIds.length - 1;
        const rankStr = String(index + 1).padStart(2, '0');

        return \`
          <div
            class="card"
            draggable="true"
            ondragstart="handleDragStart(event, \${inlineJsString(id)}, 'selected')"
            ondragover="handleCardDragOver(event)"
            ondragleave="handleCardDragLeave(event)"
            ondrop="handleCardDrop(event, \${index})"
            ondragend="handleDragEnd(event)"
          >
            <div class="card-top">
              <div class="card-title-group">
                <span class="rank-badge">\${rankStr}</span>
                <span class="badge">\${escapeHtml(p.code)}</span>
                <span class="card-title">\${escapeHtml(p.title)}</span>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm" onclick="moveFlagship(\${index}, -1)" \${isFirst ? 'disabled style=\"opacity:0.3\"' : ''} title="Move Up">?</button>
                <button class="btn btn-sm" onclick="moveFlagship(\${index}, 1)" \${isLast ? 'disabled style=\"opacity:0.3\"' : ''} title="Move Down">?</button>
                <button class="btn btn-sm btn-remove" onclick="removeFlagship(\${inlineJsString(id)})" title="Remove">?</button>
              </div>
            </div>
            <div class="card-meta">
              <span class="card-id">\${escapeHtml(p.id)}</span>
              <span class="tag">\${escapeHtml(p.category)}</span>
              <span class="tag">\${escapeHtml(p.year)}</span>
              \${p.techStack.map(t => \`<span class="tag">\${escapeHtml(t)}</span>\`).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    function addFlagship(id) {
      if (selectedIds.length >= 4) {
        showStatus('MAXIMUM FLAGSHIPS REACHED // REMOVE ONE FIRST', 'error');
        return;
      }
      if (!selectedIds.includes(id)) {
        selectedIds.push(id);
        render();
        updateUnsaved();
      }
    }

    function removeFlagship(id) {
      selectedIds = selectedIds.filter(x => x !== id);
      render();
      updateUnsaved();
    }

    function moveFlagship(index, delta) {
      const target = index + delta;
      if (target < 0 || target >= selectedIds.length) return;
      const temp = selectedIds[index];
      selectedIds[index] = selectedIds[target];
      selectedIds[target] = temp;
      render();
      updateUnsaved();
    }

    function handleSearch() {
      searchQuery = document.getElementById('searchInput').value;
      renderAvailable();
    }

    function handleDragStart(e, id, source) {
      draggedId = id;
      dragSource = source;
      e.dataTransfer.setData('text/plain', id);
      e.target.classList.add('dragging');
    }

    function handleDragEnd(e) {
      e.target.classList.remove('dragging');
      draggedId = null;
      dragSource = null;
      document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
    }

    function handleDragOver(e) {
      e.preventDefault();
    }

    function handleCardDragOver(e) {
      e.preventDefault();
      e.currentTarget.classList.add('drag-over');
    }

    function handleCardDragLeave(e) {
      e.currentTarget.classList.remove('drag-over');
    }

    function handleCardDrop(e, targetIndex) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.remove('drag-over');

      if (!draggedId) return;

      if (dragSource === 'selected') {
        const fromIndex = selectedIds.indexOf(draggedId);
        if (fromIndex !== -1 && fromIndex !== targetIndex) {
          selectedIds.splice(fromIndex, 1);
          selectedIds.splice(targetIndex, 0, draggedId);
          render();
          updateUnsaved();
        }
      } else if (dragSource === 'available') {
        if (selectedIds.length >= 4) {
          showStatus('MAXIMUM FLAGSHIPS REACHED // REMOVE ONE FIRST', 'error');
          return;
        }
        if (!selectedIds.includes(draggedId)) {
          selectedIds.splice(targetIndex, 0, draggedId);
          render();
          updateUnsaved();
        }
      }
    }

    function handleDropToSelected(e) {
      e.preventDefault();
      if (!draggedId) return;
      if (dragSource === 'available') {
        if (selectedIds.length >= 4) {
          showStatus('MAXIMUM FLAGSHIPS REACHED // REMOVE ONE FIRST', 'error');
          return;
        }
        if (!selectedIds.includes(draggedId)) {
          selectedIds.push(draggedId);
          render();
          updateUnsaved();
        }
      }
    }

    function handleDropToAvailable(e) {
      e.preventDefault();
      if (dragSource === 'selected' && draggedId) {
        removeFlagship(draggedId);
      }
    }

    function updateUnsaved() {
      document.getElementById('saveSummary').innerText = 'UNSAVED CHANGES (' + selectedIds.length + ' selected)';
    }

    async function saveFlagships() {
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.innerText = 'SAVING...';
      saveBtn.disabled = true;

      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flagshipProjectIds: selectedIds })
        });
        const result = await res.json();
        if (result.success) {
          showStatus('? CONFIGURATION WRITTEN // ' + result.savedIds.length + ' FLAGSHIP SYSTEMS SAVED TO src/config/ownerPreferences.ts', 'success');
          document.getElementById('saveSummary').innerText = 'SAVED (' + result.savedIds.length + ' FLAGSHIPS)';
        } else {
          showStatus('Error saving: ' + (result.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        showStatus('Network error while saving: ' + err.message, 'error');
      } finally {
        saveBtn.innerText = 'SAVE FLAGSHIPS';
        saveBtn.disabled = false;
      }
    }

    function showStatus(msg, type) {
      const banner = document.getElementById('statusBanner');
      banner.className = 'status-banner ' + type;
      banner.innerText = msg;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function inlineJsString(value) {
      return escapeHtml(JSON.stringify(String(value)));
    }

    init();
  </script>
</body>
</html>`;
}

export function createFlagshipConfiguratorServer(): http.Server {
  const server = http.createServer((req, res) => {
    // Strict localhost Host header verification
    const host = req.headers.host || '';
    const hostname = host.split(':')[0].trim().toLowerCase();
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden: Flagship configurator binds strictly to localhost');
      return;
    }

    // Strict Origin check on mutation requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method || '')) {
      const origin = req.headers.origin;
      if (origin) {
        try {
          const originHost = new URL(origin).hostname.toLowerCase();
          if (originHost !== '127.0.0.1' && originHost !== 'localhost') {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden: Foreign Origin rejected');
            return;
          }
        } catch {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden: Invalid Origin header');
          return;
        }
      }
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderHtmlPage());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      const projects = getProjectsSummary();
      const currentSelected = OWNER_PORTFOLIO_PREFERENCES.flagshipProjectIds || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ projects, selectedIds: currentSelected }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/save') {
      let body = '';
      let totalSize = 0;
      const MAX_BYTES = 64 * 1024; // 64KB

      req.on('data', chunk => {
        totalSize += chunk.length;
        if (totalSize > MAX_BYTES) {
          req.destroy();
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
          return;
        }
        body += chunk;
      });

      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const availableIds = (GITHUB_SNAPSHOT.projects || []).map(p => p.id);
          const titleMap = getProjectTitleMap();

          const result = writeOwnerPreferences(
            PREFERENCES_PATH,
            parsed.flagshipProjectIds,
            availableIds,
            titleMap
          );

          if (result.success) {
            // Update in-memory preference reference
            OWNER_PORTFOLIO_PREFERENCES.flagshipProjectIds = result.savedIds;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, savedIds: result.savedIds }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: result.error }));
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Invalid JSON' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return server;
}

function start() {
  const server = createFlagshipConfiguratorServer();
  server.listen(DEFAULT_CONFIGURATOR_PORT, DEFAULT_CONFIGURATOR_HOST, () => {
    console.log('='.repeat(64));
    console.log('SYSTEMS CARTOGRAPHY // FLAGSHIP SYSTEMS CONFIGURATOR');
    console.log('='.repeat(64));
    console.log(`URL: http://${DEFAULT_CONFIGURATOR_HOST}:${DEFAULT_CONFIGURATOR_PORT}`);
    console.log('Bind: 127.0.0.1 (localhost only - not exposed to network)');
    console.log('Target: src/config/ownerPreferences.ts');
    console.log('='.repeat(64));
    console.log('Press Ctrl+C to stop the configurator server.');
  });
}

if (process.argv[1]?.endsWith('setup-flagships.ts')) {
  start();
}
