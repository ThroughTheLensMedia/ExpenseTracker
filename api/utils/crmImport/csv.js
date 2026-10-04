'use strict';

const fs = require('fs');
const { Readable } = require('stream');
const csvParser = require('csv-parser');

const MAX_ROWS = 20000;

// Reads a whole CSV into { headers, rows }. Headers keep their original spelling (trimmed,
// BOM stripped); a repeated header gets a " (2)" suffix so no column is silently overwritten.
// Each row is an object keyed by those headers, values trimmed.
function parseStream(stream) {
    return new Promise((resolve, reject) => {
        const headers = [];
        const seen = new Map();
        const rows = [];
        let tooMany = false;

        const parser = csvParser({
            mapHeaders: ({ header }) => {
                const base = String(header || '').replace(/^﻿/, '').trim();
                const n = (seen.get(base) || 0) + 1;
                seen.set(base, n);
                const name = n === 1 ? base : `${base} (${n})`;
                headers.push(name);
                return name;
            },
            mapValues: ({ value }) => String(value == null ? '' : value).trim(),
        });

        stream.on('error', reject);
        parser.on('error', reject);
        parser.on('data', row => {
            if (rows.length >= MAX_ROWS) { tooMany = true; return; }
            rows.push(row);
        });
        parser.on('end', () => {
            if (tooMany) return reject(new Error(`File has more than ${MAX_ROWS.toLocaleString()} rows. Split it into smaller files and import them one at a time.`));
            resolve({ headers: headers.filter(h => h !== ''), rows });
        });
        stream.pipe(parser);
    });
}

const parseCsvFile = filePath => parseStream(fs.createReadStream(filePath));
const parseCsvText = text => parseStream(Readable.from([String(text)]));

module.exports = { parseCsvFile, parseCsvText, MAX_ROWS };
