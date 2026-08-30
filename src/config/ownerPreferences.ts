/**
 * OWNER PORTFOLIO PREFERENCES
 *
 * Persistent, owner-curated configuration for flagship project display.
 * This file is updated by `npm run setup:flagships` and survives GitHub syncs.
 */

export interface OwnerPortfolioPreferences {
  flagshipProjectIds: string[];
}

export const OWNER_PORTFOLIO_PREFERENCES: OwnerPortfolioPreferences = {
  flagshipProjectIds: [
    'gh-1237757392', // pillcheck-public
    'gh-1347309405', // Systems_Cartography_Portfolio
    'gh-1301560608', // formcrash
    'gh-1335930004' // physio_bot
  ]
};
