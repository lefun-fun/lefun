import "./index.css";

import { Trans } from "@lingui/macro";
import classNames from "classnames";

import type { UserId } from "@lefun/core";
import {
  makeUseMakeMove,
  makeUseSelector,
  makeUseSelectorShallow,
  useIsPlayer,
  useUsername,
} from "@lefun/ui";

import type { RollGame, RollGameState } from "roll-game";

// Dice symbol characters
const DICE = ["", "\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];

const useSelector = makeUseSelector<RollGameState>();
const useSelectorShallow = makeUseSelectorShallow<RollGameState>();
const useMakeMove = makeUseMakeMove<RollGame>();

function Player({ userId }: { userId: UserId }) {
  const itsMe = useSelector((state) => state.userId === userId);
  const username = useUsername(userId);

  return (
    <div className="player">
      <span className={classNames(itsMe && "bold")}>{username}</span>
      <Die userId={userId} />
    </div>
  );
}

function Die({ userId }: { userId: UserId }) {
  const diceValue = useSelector(
    (state) => state.board.players[userId].diceValue,
  );
  const isRolling = useSelector(
    (state) => state.board.players[userId].isRolling,
  );

  return (
    <span className="dice">
      {isRolling || !diceValue ? "?" : DICE[diceValue]}
    </span>
  );
}

function Board() {
  const makeMove = useMakeMove();
  const players = useSelectorShallow((state) =>
    Object.keys(state.board.players),
  );

  const isPlayer = useIsPlayer();

  return (
    <div>
      <div>
        <Trans>The template game</Trans>
        {players.map((userId) => (
          <Player key={userId} userId={userId} />
        ))}
      </div>
      {isPlayer && (
        <>
          <button onClick={() => makeMove("roll")}>
            <Trans>Roll</Trans>
          </button>
          <button
            onClick={() => {
              makeMove("moveWithArg", { someArg: "123" });
            }}
          >
            Go
          </button>
        </>
      )}
    </div>
  );
}

export default Board;
