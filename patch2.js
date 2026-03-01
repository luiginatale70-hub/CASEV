const fs = require('fs');
const file = './esami/routes/admin.js';
let src = fs.readFileSync(file, 'utf8');

const fixes = [
  ["redirect('/admin/classes/new')",    "redirect('/esami/admin/classes/new')"],
  ["redirect('/admin/classes')",        "redirect('/esami/admin/classes')"],
  ["redirect('/admin/instructors/new')", "redirect('/esami/admin/instructors/new')"],
  ["redirect('/admin/students/new')",   "redirect('/esami/admin/students/new')"],
  ["redirect('/admin/students')",       "redirect('/esami/admin/students')"],
  ["redirect('/admin')",                "redirect('/esami/admin')"],
];

let count = 0;
for (const [from, to] of fixes) {
  while (src.includes(from)) {
    src = src.replace(from, to);
    count++;
  }
}

fs.writeFileSync(file, src, 'utf8');
console.log('✅ PATCH 2 applicata: ' + count + ' redirect corretti.');
