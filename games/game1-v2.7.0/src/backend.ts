import { AutoMove } from "@lefun/game";

import { G, GS } from "./game";

export const autoMove: AutoMove<GS, G> = ({ random }) => {
  if (random.bernoulli()) {
    return "pass";
  }
  return "roll";
};
