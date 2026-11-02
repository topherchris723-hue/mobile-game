// Worker for lib.mjs runJobs: runs `count` battles from seed0 and posts the rows back.
import { workerData, parentPort } from 'node:worker_threads';
import { buildContent, runOne } from './lib.mjs';

const job = workerData;
const content = buildContent(job);
const rows = [];
for (let i = 0; i < job.count; i++) rows.push(runOne(content, job.cfg, job.seed0 + i));
parentPort.postMessage(rows);
