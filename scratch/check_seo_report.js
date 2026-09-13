const fs = require('fs');

if (!fs.existsSync('scratch_lighthouse.json')) {
  console.log('File scratch_lighthouse.json not ready yet');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync('scratch_lighthouse.json', 'utf8'));
const seo = report.categories.seo;
console.log('=== LIGHTHOUSE SEO SCORE:', seo.score * 100, '===');

seo.auditRefs.forEach(ref => {
  const audit = report.audits[ref.id];
  if (audit.score !== 1) {
    console.log(`\n[-] FAIL/WARN: [${ref.id}] (Weight: ${ref.weight}, Score: ${audit.score})`);
    console.log(`    Title: ${audit.title}`);
    console.log(`    Description: ${audit.description}`);
    if (audit.explanation) console.log(`    Explanation: ${audit.explanation}`);
    if (audit.details && audit.details.items && audit.details.items.length) {
      console.log(`    Items:`, JSON.stringify(audit.details.items.slice(0, 5), null, 2));
    }
  } else {
    console.log(`[+] PASS: [${ref.id}] ${audit.title}`);
  }
});
