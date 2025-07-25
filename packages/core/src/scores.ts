import { GameStatType, UserId } from ".";

/*
 * Given some `scores`, get ranks for players.
 */
export const getRanks = ({
  scores,
  gameStatType,
}: {
  scores: Record<UserId, number>;
  gameStatType: GameStatType;
}): Record<UserId, number> => {
  let higherIsBetter: boolean;
  switch (gameStatType) {
    case "integer":
    case "number":
    case "boolean":
      higherIsBetter = true;
      break;
    case "rank":
    case "seconds":
      higherIsBetter = false;
      break;
  }

  const ranks: Record<UserId, number> = {};

  // Extract the list of all points. Filter to only keep valid points.
  // Otherwise we could end up with an infinite loop later!
  let points = Object.values(scores).filter(
    (score) => score != null && isFinite(score),
  );

  let currentRank = 0;

  let best: number;
  while (points.length > 0) {
    // Find the next highest score.
    best = (higherIsBetter ? Math.max : Math.min)(...points);

    // Keep only the players with that score.
    const usersForThisRank: UserId[] = Object.keys(scores).filter(
      (userId) => scores[userId] === best,
    );

    // They get the current rank.
    usersForThisRank.forEach((userId) => {
      ranks[userId] = currentRank;
    });

    currentRank += usersForThisRank.length;

    points = points.filter((p) => p !== best);
  }

  return ranks;
};
