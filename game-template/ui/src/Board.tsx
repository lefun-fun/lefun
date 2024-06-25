import "./index.css";

import classNames from "classnames";

import type { UserId } from "@lefun/core";
import {
  useUsername,
  makeUseSelector,
  makeUseSelectorShallow,
  makeUseMakeMove,
} from "@lefun/ui";

import { GS, PM } from "roll-game";

import { Trans } from "@lingui/macro";

// Dice symbol characters
const DICE = ["", "\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];

const useSelector = makeUseSelector<GS>();
const useSelectorShallow = makeUseSelectorShallow<GS>();
const useMakeMove = makeUseMakeMove<GS, PM>();

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

  return (
    <div>
      <div>
        <Trans>The template game</Trans>
        {players.map((userId) => (
          <Player key={userId} userId={userId} />
        ))}
      </div>
      <button onClick={() => makeMove("roll")}>
        <Trans>Roll</Trans>
      </button>
      <button
        onClick={() => {
          makeMove("moveWithArg", { someArg: "123" });
          makeMove("moveWithArg", { someArg: "123" });
        }}
      >
        Go
      </button>
    </div>
  );
}

export default Board;
