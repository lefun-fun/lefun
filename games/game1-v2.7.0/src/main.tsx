import { render } from "@lefun/dev-server";

import { game } from "./game";
// @ts-expect-error abc
import { messages as en } from "./locales/en/messages";
// @ts-expect-error abc
import { messages as fr } from "./locales/fr/messages";

await render({
  board: async () => {
    const { default: Board } = await import("./Board");
    await import("./index.css");
    return <Board />;
  },
  game,
  messages: { en, fr },
  gameId: "game1-v2.5.3",
});
