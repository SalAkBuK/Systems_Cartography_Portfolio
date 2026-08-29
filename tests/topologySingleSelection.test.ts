import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
const canvasSource = fs.readFileSync(path.resolve('src/components/TopologyCanvas.tsx'), 'utf8');

function block(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return source.substring(start, end);
}

const handleSelectProject = block(appSource, 'const handleSelectProject = useCallback', 'const handleDrillIntoProject');
const handleSelectSkill = block(appSource, 'const handleSelectSkill = useCallback', 'const handleSelectExperience');
const handleSelectExperience = block(appSource, 'const handleSelectExperience = useCallback', 'const handleResetView');

test('1/6. selecting a project clears any prior project selection (single selectedProjectId)', () => {
  assert.match(handleSelectProject, /if \(selectedProjectId === id\)/, 'clicking the currently-selected project must toggle it off');
  assert.ok(handleSelectProject.includes('setSelectedProjectId(id);'), 'a different project replaces selectedProjectId, never appends');
});

test('2. selecting a project clears capability and experience selection', () => {
  assert.ok(handleSelectProject.includes('setSelectedSkillId(null);'), 'selecting a project must clear capability selection');
  assert.ok(handleSelectProject.includes('setSelectedExperienceId(null);'), 'selecting a project must clear experience selection');
});

test('3. selecting a capability clears project and experience selection', () => {
  assert.match(handleSelectSkill, /if \(selectedSkillId === id\)/, 'clicking the currently-selected capability must toggle it off');
  assert.ok(handleSelectSkill.includes('setSelectedProjectId(null);'), 'selecting a capability must clear project selection');
  assert.ok(handleSelectSkill.includes('setSelectedExperienceId(null);'), 'selecting a capability must clear experience selection');
});

test('4. selecting an experience clears project and capability selection', () => {
  assert.match(handleSelectExperience, /if \(selectedExperienceId === id\)/, 'clicking the currently-selected experience must toggle it off');
  assert.ok(handleSelectExperience.includes('setSelectedProjectId(null);'), 'selecting an experience must clear project selection');
  assert.ok(handleSelectExperience.includes('setSelectedSkillId(null);'), 'selecting an experience must clear capability selection');
});

test('5. no multi-select state exists — each selection is a single nullable id, not a collection', () => {
  assert.match(appSource, /const \[selectedProjectId, setSelectedProjectId\] = useState<string \| null>\(null\);/);
  assert.match(appSource, /const \[selectedSkillId, setSelectedSkillId\] = useState<string \| null>\(null\);/);
  assert.match(appSource, /const \[selectedExperienceId, setSelectedExperienceId\] = useState<string \| null>\(null\);/);
  assert.ok(!appSource.includes('selectedProjectIds'), 'must not introduce a plural/array selection variant');
});

test('7. TopologyCanvas derives project isSelected strictly from selectedProjectId === project.id', () => {
  assert.match(canvasSource, /const isSelected = selectedProjectId === project\.id;/, 'must be a strict single-id equality, never an array/Set membership check');
});

test('8. TopologyCanvas derives capability isSelected strictly from selectedSkillId === skill.id', () => {
  assert.match(canvasSource, /const isSelected = selectedSkillId === skill\.id;/, 'must be a strict single-id equality, never an array/Set membership check');
});

test('9. FOCUS LOCK label resolves from exactly one of the three mutually exclusive selection ids, in priority order project > skill > experience', () => {
  const focusResolver = block(canvasSource, 'const selectedFocusLabel = useMemo(', '// Static orbital lattice');
  assert.match(focusResolver, /if \(selectedProjectId\) \{/);
  assert.match(focusResolver, /if \(selectedSkillId\) \{/);
  assert.match(focusResolver, /if \(selectedExperienceId\) \{/);
});

test('10. selected-node visual emphasis (highlighted) is not the exclusive selected marker — hover produces the same emphasis level, so a dedicated selected-only element must exist', () => {
  // getTopologyNodeEmphasis intentionally returns 'highlighted' for isHovered OR
  // isSelected OR isDragging alike (hover and selection share the accent-green
  // focus treatment by design). The drill-in arrow button, gated strictly on
  // isSelected, is the only persistent marker that cannot be produced by hover
  // alone — this is what actually distinguishes "selected" from "hovered" once
  // the pointer moves off the node.
  const drillInCommentIndex = canvasSource.indexOf('{/* Drill-in icon button */}');
  assert.ok(drillInCommentIndex !== -1);
  const drillInGuardIndex = canvasSource.indexOf('{isSelected && (', drillInCommentIndex);
  assert.ok(
    drillInGuardIndex !== -1 && drillInGuardIndex - drillInCommentIndex < 80,
    'the drill-in button must be gated strictly on isSelected, immediately following its comment'
  );
});

test('11. no stale multi-selection bug: hover state (hoveredProjectId/hoveredSkillId) is tracked independently of selection and never widens the isSelected check', () => {
  const isSelectedProjectLine = canvasSource.match(/const isSelected = selectedProjectId === project\.id;/);
  const isSelectedSkillLine = canvasSource.match(/const isSelected = selectedSkillId === skill\.id;/);
  assert.ok(isSelectedProjectLine && isSelectedSkillLine, 'isSelected must never OR in hoveredProjectId/hoveredSkillId or any other id');
});
