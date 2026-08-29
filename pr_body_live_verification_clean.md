## Summary

This PR addresses all findings from live/manual verification of the Systems Cartography Portfolio through `SalAkBuK/test-template`, incorporating independent review feedback:

1. **Live TowerDesk Repositories**:
   - Migrated all evidence to live canonical repositories: `towerdesk-backend`, `tower-desk`, and `towerdesk-mobile-app`.
   - Updated `REPOSITORY_CANONICAL_CLUSTERS` so historical/legacy aliases (`towerdesk-backend-clean`, `tower-desk-clean`, `towerdesk-mobile-showcase`, `binghatti-concierge-app-rn-expo`) cleanly resolve to canonical keys.
   - Removed obsolete "sanitized showcase" claims across evidence sources.

2. **Deterministic Evidence Resolver**:
   - Implemented pure resolution functions `resolveProjectFromEvidenceKey` and `resolveProjectIdFromEvidenceKey` in `src/utils/portfolioUtils.ts`.
   - Replaced raw repository ID passing in `src/components/RightInspectorPanel.tsx` with dynamic runtime resolution (`gh-...`), fixing Worthy CRM, Remapp, and TowerDesk professional evidence inspect actions.

3. **Experience Filter & Topology Modes Composition**:
   - Composed Professional Experience filtering across Systems, Capabilities, and Relationships modes (`getTopologyNodeEmphasis` and `getConduitPresentationState`).
   - Experience selection acts as an authoritative filter: unrelated conduits and unlinked capabilities in Capabilities/Relationships modes remain strictly dimmed/hidden even when hovered.

4. **One-Way Module Architecture**:
   - Eliminated circular dependencies between `portfolioUtils.ts` and `capabilityAssociations.ts`.
   - `getCapabilitiesLinkedToExperience` is owned by `capabilityAssociations.ts`, preserving clean one-way dependency (`capabilityAssociations -> portfolioUtils`).

5. **Unified Compact Responsive Breakpoint (`lg`)**:
   - Replaced fixed `h-72` panel with a collapsible bottom sheet on `< lg` (`h-11` collapsed, `h-[62vh]` expanded).
   - Removed desktop `BottomCommandStrip` on `< lg` (`hidden lg:flex`) to eliminate bottom viewport collision.
   - Standardized canvas telemetry and corner labels to `hidden lg:flex`.
   - Adjusted floating control rail to `bottom-14 lg:bottom-4` to clear the collapsed inspector sheet.
   - Added distinct mobile `MINIMIZE` (purely collapses sheet) and `✕ CLEAR` (collapses sheet and clears active selections without altering viewport).

6. **Brutalist Telemetry & Zoom Cleanliness**:
   - Styled `OWNER PROJECTS` in `TopTelemetryBar.tsx` into an independent black brutalist container (`#15150F`).
   - Removed duplicate `Zoom In` button in `TopologyCanvas.tsx`.

7. **Environment-Only Sync Authentication**:
   - Preserved safe environment-only token resolution (`GITHUB_TOKEN`, `GH_TOKEN`) in `scripts/sync-github-snapshot.ts` with no CLI token argument exposure.

## Local Validation Results

- **Unit & Regression Tests**: `npm test` -> **226 / 226 tests passing** (including regression tests A through W).
- **TypeScript Linting**: `npm run lint` (`tsc --noEmit`) -> **0 errors**.
- **Production Build**: `npm run build` (`vite build`) -> **Successfully generated production bundle** (`dist/index.html`, `dist/assets/index-*.js`, `dist/assets/index-*.css`).
