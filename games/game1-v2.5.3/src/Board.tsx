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

import type { G, GS } from "./game";

const useSelector = makeUseSelector<GS>();
const useSelectorShallow = makeUseSelectorShallow<GS>();
const useMakeMove = makeUseMakeMove<G>();

function Player({ userId }: { userId: UserId }) {
  const itsMe = useSelector((state) => state.userId === userId);
  const username = useUsername(userId);

  const color = useSelector(
    (state) => state.board.matchPlayersSettings[userId].color,
  );

  return (
    <div className="player">
      <span className={classNames(itsMe && "bold", color)}>{username}</span>
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
    <div>
      Dice Value:{" "}
      <span className="dice">{isRolling || !diceValue ? "?" : diceValue}</span>
    </div>
  );
}

function Board() {
  const makeMove = useMakeMove();
  const players = useSelectorShallow((state) =>
    Object.keys(state.board.players),
  );

  const matchSettings = useSelector((state) => state.board.matchSettings);

  const isPlayer = useIsPlayer();

  return (
    <div>
      <div>
        <Trans>The template game</Trans>
        {Object.entries(matchSettings).map(([key, value]) => (
          <div key={key}>
            <span className="bold">{key}:</span> {value}
          </div>
        ))}
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
