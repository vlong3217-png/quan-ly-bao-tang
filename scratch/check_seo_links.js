const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const regex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
let match;
let count = 0;
while ((match = regex.exec(html)) !== null) {
  const attrs = match[1];
  const innerHtml = match[2];
  const text = innerHtml.replace(/<[^>]*>/g, '').trim();
  const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
  const href = hrefMatch ? hrefMatch[1] : 'NO_HREF';
  const ariaLabel = attrs.match(/aria-label=["']([^"']*)["']/i);
  console.log(`${count}: href="${href}" text="${text}" aria="${ariaLabel ? ariaLabel[1] : ''}"`);
  count++;
}
