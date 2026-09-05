// Focused regression for a one-class spacing fix: the Resume Modal's header
// content block (operator name, focus text, location/email/GitHub/LinkedIn
// metadata) had no horizontal inset of its own, so its text visually touched
// the block's bottom divider line. Fix: add px-3.5 to that block only,
// matching the horizontal inset already used by the card immediately below
// it (the "01 // Engineering Profile" card). Matches this codebase's
// established convention (pure source-text node:test assertions against the
// component file -- see tests/topologyPersistentMount.test.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const modalSource = fs.readFileSync(path.resolve('src/components/ResumeModal.tsx'), 'utf8');

test('Resume Modal header content block has horizontal breathing room, retaining its existing bottom spacing/border', () => {
  assert.ok(
    modalSource.includes('<div className="border-b-2 border-precision px-3.5 pb-4 flex flex-col gap-1.5">'),
    'the header content block must gain px-3.5 while keeping border-b-2 border-precision pb-4 flex flex-col gap-1.5 unchanged'
  );
});

test('the FULL STACK ENGINEER role badge itself is untouched -- it only inherits the shared container inset', () => {
  assert.match(
    modalSource,
    /<span className="text-\[10px\] px-2 py-0\.5 bg-\[#15150F\] text-\[#C3E54E\] font-bold">\s*\{activeOperator\.role\.toUpperCase\(\)\}/,
    'the role badge\'s own className/markup must be unchanged by the header spacing fix'
  );
});
