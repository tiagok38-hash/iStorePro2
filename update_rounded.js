const fs = require('fs');
const path = require('path');

function walk(dir, done) {
    let results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        // Ignore node_modules completely!
        list = list.filter(f => !f.includes('node_modules') && !f.includes('.git'));
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push(file);
                    if (!--pending) done(null, results);
                }
            });
        });
    });
}

const dir = process.argv[2] || process.cwd();
walk(dir, (err, results) => {
    if (err) throw err;
    const tsxFiles = results.filter(f => f.endsWith('.tsx'));

    let totalChangedFiles = 0;

    tsxFiles.forEach(file => {
        let content = fs.readFileSync(file, 'utf-8');
        let lines = content.split('\n');
        let changed = false;

        for (let i = 0; i < lines.length; i++) {
            let l = lines[i];

            if (
                l.includes('<input ') ||
                l.includes('<select ') ||
                l.includes('<textarea ') ||
                l.includes('inputClasses') ||
                l.includes('focus-within:border') ||
                l.includes('focus-within:ring') ||
                l.includes('CurrencyInput') ||
                l.includes('SearchableDropdown') ||
                l.includes('className="flex items-center border border-gray-200 rounded-')
            ) {
                let newL = l.replace(/rounded-(none|sm|md|lg|2xl|3xl|full)\b/g, 'rounded-xl');
                if (newL !== l) {
                    lines[i] = newL;
                    changed = true;
                }
            }
        }

        if (changed) {
            fs.writeFileSync(file, lines.join('\n'));
            console.log('Updated: ' + path.basename(file));
            totalChangedFiles++;
        }
    });

    console.log('Total files changed: ' + totalChangedFiles);
});
