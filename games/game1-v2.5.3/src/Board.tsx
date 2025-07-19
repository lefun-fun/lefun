import "./index.css";

import { Trans } from "@lingui/macro";
import classNames from "classnames";
import { useEffect, useState } from "react";

import type { UserId } from "@lefun/core";
import {
  makeUseMakeMove,
  makeUseSelector,
  makeUseSelectorShallow,
  useUsername,
} from "@lefun/ui";

import { G, getCurrentPlayer, GS } from "./game";

const useSelector = makeUseSelector<GS>();
const useSelectorShallow = makeUseSelectorShallow<GS>();
const useMakeMove = makeUseMakeMove<G>();

function Player({ userId }: { userId: UserId }) {
  const itsMe = useSelector((state) => state.userId === userId);
  const username = useUsername(userId);

  const myLastRollAt = useSelector((state) => state.playerboard?.lastRollAt);

  const color = useSelector(
    (state) => state.board.matchPlayersSettings[userId].color,
  );

  const expiresAt = useSelector(
    (state) => state.board.players[userId].expiresAt,
  );

  const isDead = useSelector((state) => state.board.players[userId].isDead);

  return (
    <div className="player">
      <span className={classNames(itsMe && "bold", color)}>
        {username} {isDead ? "💀" : "😊"}
      </span>
      <Die userId={userId} />
      Expires in: {expiresAt ? <CountDown ts={expiresAt} /> : ""}
      {itsMe && myLastRollAt}
    </div>
  );
}

const CountDown = ({ ts }: { ts: number | undefined | null }) => {
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    if (!ts) {
      return;
    }
    const i = setInterval(() => {
      setDelta(Math.max(ts - new Date().getTime(), 0));
    }, 100);

    return () => clearInterval(i);
  }, [ts]);

  if (!ts) {
    return null;
  }

  return <div>{delta}</div>;
};

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

const EndMatchCountDown = () => {
  const endsAt = useSelector((state) => state.board.endsAt);
  return <CountDown ts={endsAt} />;
};

function Board() {
  const makeMove = useMakeMove();
  const players = useSelectorShallow((state) =>
    Object.keys(state.board.players),
  );

  const matchSettings = useSelector((state) => state.board.matchSettings);

  const sum = useSelector((state) => state.board.sum);

  const itsMyTurn = useSelector(
    (state) => getCurrentPlayer(state.board) === state.userId,
  );

  return (
    <div className="outer">
      <div className="inner">
        <div>
          <Trans>The template game</Trans>
          <div>Sum: {sum}</div>
          <EndMatchCountDown />
          {Object.entries(matchSettings).map(([key, value]) => (
            <div key={key}>
              <span className="bold">{key}:</span> {value}
            </div>
          ))}
          {players.map((userId) => (
            <Player key={userId} userId={userId} />
          ))}
        </div>

        <>
          <button
            className={classNames(!itsMyTurn && "disabled")}
            onClick={() => makeMove("roll")}
          >
            <Trans>Roll</Trans>
          </button>
          <button
            className={classNames(!itsMyTurn && "disabled")}
            onClick={() => makeMove("pass")}
          >
            <Trans>Pass</Trans>
          </button>
        </>
      </div>
    </div>
  );
}

export default Board;
