/*
 * We define here the keys used for the game messages for i18n.
 */
export const gameMessageKeys: Record<string, (...args: any[]) => string> = {
  name() {
    return "lefun.name";
  },
  tagline() {
    return "lefun.tagline";
  },
  aka() {
    return "lefun.aka";
  },
  seoAka() {
    return "lefun.seoAka";
  },
  description() {
    return "lefun.description";
  },
  //
  gameSettingLabel(key: string) {
    return `lefun.settings.${key}.label`;
  },
  gameSettingHelp(key: string) {
    return `lefun.settings.${key}.help`;
  },
  gameSettingOptionLabel(key: string, value: string) {
    return `lefun.settings.${key}.options.${value}.label`;
  },
  gameSettingOptionShortLabel(key: string, value: string) {
    return `lefun.settings.${key}.options.${value}.shortLabel`;
  },
  //
  gamePlayerSettingLabel(key: string) {
    return `lefun.playerSettings.${key}.label`;
  },
  gamePlayerSettingOptionLabel(key: string, value: string) {
    return `lefun.playerSettings.${key}.options.${value}.label`;
  },
};
