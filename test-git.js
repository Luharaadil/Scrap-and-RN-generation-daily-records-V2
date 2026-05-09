const { execSync } = require('child_process');
console.log(execSync('git log -p src/components/ProductionEntry.tsx').toString());
