/**
 * Dashboard state — single source of truth.
 */
import { DEFAULT_ACCOUNT } from './config.js';

export const state = {
  accountId:         DEFAULT_ACCOUNT,
  accountName:       '',
  accountCurrency:   'IDR',
  activeAdGroup:     'Regular Ads',
  campaigns:         [],
  filteredCampaigns: [],
  insightMap:        {},
  campaignMeta:      {},
  currentPage:       1,
  sortKey:           'spend',
  sortDir:           'desc',
  dateRange:         'last_7d',
  drawerCampaignId:  null,
  _campaignInsights: [],
};
