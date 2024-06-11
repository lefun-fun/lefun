import { expect, test } from "vitest";

import {
  Meta,
  metaAddUserToMatch,
  metaInitialState,
  metaRemoveUserFromMatch,
} from ".";

test("meta initialize add remove", () => {
  const locale = "en";

  const meta = metaInitialState({ matchSettings: { patate: "1" }, locale });

  const expectedMeta: Meta = {
    players: {
      allIds: [],
      byId: {},
    },
    matchSettings: { patate: "1" },
    matchPlayersSettings: {},
    settings: {},
    locale,
  };

  const checkMeta = () => {
    expect(meta).toEqual(expectedMeta);
  };

  checkMeta();

  const now = new Date();
  metaAddUserToMatch({ meta, userId: "poil", ts: now, isBot: false });

  expectedMeta.players = {
    allIds: ["poil"],
    byId: {
      poil: {
        ready: true,
        itsYourTurn: false,
        joinedAt: now,
        isBot: false,
      },
    },
  };

  expectedMeta.matchPlayersSettings["poil"] = {};

  checkMeta();

  metaAddUserToMatch({ meta, userId: "patate", ts: now, isBot: true });

  expectedMeta.players = {
    allIds: ["poil", "patate"],
    byId: {
      poil: {
        ready: true,
        itsYourTurn: false,
        joinedAt: now,
        isBot: false,
      },
      patate: {
        ready: true,
        itsYourTurn: false,
        joinedAt: now,
        isBot: true,
      },
    },
  };
  expectedMeta.matchPlayersSettings["patate"] = {};

  checkMeta();

  metaRemoveUserFromMatch(meta, "patate");

  expectedMeta.players = {
    allIds: ["poil"],
    byId: {
      poil: {
        ready: true,
        itsYourTurn: false,
        joinedAt: now,
        isBot: false,
      },
    },
  };
  delete expectedMeta.matchPlayersSettings["patate"];

  checkMeta();

  metaAddUserToMatch({ meta, userId: "patate", ts: now, isBot: false });

  expectedMeta.players = {
    allIds: ["poil", "patate"],
    byId: {
      poil: {
        ready: true,
        itsYourTurn: false,
        joinedAt: now,
        isBot: false,
      },
      patate: {
        ready: true,
        itsYourTurn: false,
        joinedAt: now,
        isBot: false,
      },
    },
  };

  expectedMeta.matchPlayersSettings["patate"] = {};

  checkMeta();
});
