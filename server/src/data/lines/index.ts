// server/src/data/lines/index.ts
import { BoardLine } from '@nannaricher/shared';
import { pukouLine } from './pukou';
import { studyLine } from './study';
import { moneyLine } from './money';
import { suzhouLine } from './suzhou';
import { exploreLine } from './explore';
import { gulouLine } from './gulou';
import { xianlinLine } from './xianlin';
import { foodLine } from './food';

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
