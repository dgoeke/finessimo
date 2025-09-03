#!/usr/bin/env node
// Quick script to fix duplicate variable declarations in test files

const fs = require('fs');

function fixDuplicateDestructuring(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace duplicate destructuring patterns within the same test
  // This is a simple fix - combining common patterns
  
  // Pattern 1: fillRect declarations
  content = content.replace(
    /const { fillRect } = getMockCanvasMethods\(mockCtx\);\s+expect\(fillRect\)[^}]+}\);[\s\n]*const { fillRect } = getMockCanvasMethods\(mockCtx\);/g,
    'const { fillRect } = getMockCanvasMethods(mockCtx);'
  );
  
  // Pattern 2: Multiple method calls in same test
  content = content.replace(
    /const { (\w+) } = getMockCanvasMethods\(mockCtx\);\s+expect\(\1\)[^}]+}\);[\s\n]*const { (\w+) } = getMockCanvasMethods\(mockCtx\);/g,
    'const { $1, $2 } = getMockCanvasMethods(mockCtx);'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed duplicates in ${filePath}`);
}

// Fix the problem files
const files = [
  '/Users/dg/repos/finessimo/tests/unit/ui/renderers/viewport.test.ts',
  '/Users/dg/repos/finessimo/tests/unit/ui/renderers/overlays.test.ts'
];

files.forEach(fixDuplicateDestructuring);