// server/src/data/lines/index.ts
import { BoardLine } from '@nannaricher/shared';
import { pukouLine } from './pukou.js';
import { studyLine } from './study.js';
import { moneyLine } from './money.js';
import { suzhouLine } from './suzhou.js';
import { exploreLine } from './explore.js';
import { gulouLine } from './gulou.js';
import { xianlinLine } from './xianlin.js';
import { foodLine } from './food.js';

export const allLines: Record<string, BoardLine> = {
  pukou: pukouLine,
  study: studyLine,
  money: moneyLine,
  suzhou: suzhouLine,
  explore: exploreLine,
  gulou: gulouLine,
  xianlin: xianlinLine,
  food: foodLine,
};

export { pukouLine, studyLine, moneyLine, suzhouLine, exploreLine, gulouLine, xianlinLine, foodLine };
