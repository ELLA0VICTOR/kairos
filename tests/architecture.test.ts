import { readFileSync, readdirSync } from 'node:fs';
import { expect,test } from 'vitest';
test('engine has no React, provider, I/O, ambient clock or unseeded random imports',()=>{
  for(const name of readdirSync('engine').filter(n=>n.endsWith('.ts'))) {
    const source=readFileSync(`engine/${name}`,'utf8');
    expect(source).not.toMatch(/from\s+['"](?:react|@\/|\.\.\/src|node:fs|node:http)/);
    expect(source).not.toMatch(/\b(?:Date\.now|Math\.random|fetch)\s*\(/);
  }
});
