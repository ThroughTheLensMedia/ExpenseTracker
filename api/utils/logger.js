const pino = require('pino');
const { Logtail } = require('@logtail/node');

// Only init Logtail if token is present — falls back to console-only in local dev
const logtail = process.env.LOGTAIL_SOURCE_TOKEN
    ? new Logtail(process.env.LOGTAIL_SOURCE_TOKEN)
    : null;

const targets = [
    {
        target: 'pino/file',
        options: { destination: 1 }, // stdout
        level: 'info',
    },
];

const logger = pino(
    {
        level: 'info',
        base: { service: 'lumiere-ledger-api' },
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream(
        logtail
            ? [
                  { stream: { write: (msg) => logtail.log(msg) }, level: 'info' },
                  { stream: process.stdout, level: 'info' },
              ]
            : [{ stream: process.stdout, level: 'info' }]
    )
);

module.exports = logger;
