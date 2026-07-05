export type DistributionRuleKey =
  | "COPLANTER_PACKAGE"
  | "OPTIONAL_MONTHLY_MEMBERSHIP"
  | "OPTIONAL_ONE_TIME_MEMBERSHIP"
  | "TREE_SAVE_LIFE_DONATION"
  | "PROGRAM_SERVICE";

export type DistributionShare = {
  recipient: string;
  accountName: string;
  accountNumber: string;
  accountProvider: string;
  percent: number;
  amount: number;
};

export type DistributionRule = {
  key: DistributionRuleKey;
  label: string;
  shares: Array<Omit<DistributionShare, "amount">>;
};

export const treasuryAccounts = {
  SUR_BDO: {
    accountProvider: "BDO",
    accountName: "Donnabel Cabrido",
    accountNumber: "010148009036",
  },
  TDI_SHARE: {
    accountProvider: "Share Account",
    accountName: "Janica Maldives",
    accountNumber: "103200012264",
  },
  MARKETING_LUZON_ABROAD: {
    accountProvider: "Security Bank",
    accountName: "Antonio Junior Coral",
    accountNumber: "0000065356663",
  },
  MARKETING_VISMIN: {
    accountProvider: "UnionBank",
    accountName: "Rozendale Vale Repolidon",
    accountNumber: "1093 3005 6759",
  },
  JSTUDIOS_EVENTS: {
    accountProvider: "BDO Network Bank",
    accountName: "JStudios and Events Management Services",
    accountNumber: "040270347437",
  },
};

export const feeDistributionRules: Record<DistributionRuleKey, DistributionRule> = {
  COPLANTER_PACKAGE: {
    key: "COPLANTER_PACKAGE",
    label: "Co-Planter Package",
    shares: [
      { recipient: "SUR Aloeswood Corporation", ...treasuryAccounts.SUR_BDO, percent: 40 },
      { recipient: "TDI Technological Digital Innovation", ...treasuryAccounts.TDI_SHARE, percent: 16 },
      { recipient: "Marketing and Sales - Luzon and Abroad", ...treasuryAccounts.MARKETING_LUZON_ABROAD, percent: 8 },
      { recipient: "Marketing and Sales - Visayas and Mindanao", ...treasuryAccounts.MARKETING_VISMIN, percent: 8 },
      { recipient: "Referral / Direct Commission", accountProvider: "Internal Ledger", accountName: "Qualified Referrer", accountNumber: "REFERRAL_LEDGER", percent: 10 },
      { recipient: "Recovery Fund Mother Account", ...treasuryAccounts.SUR_BDO, percent: 16 },
      { recipient: "Program, Rewards, Gathering, Sponsorship and Marketing Promotion", ...treasuryAccounts.JSTUDIOS_EVENTS, percent: 2 },
    ],
  },
  OPTIONAL_MONTHLY_MEMBERSHIP: {
    key: "OPTIONAL_MONTHLY_MEMBERSHIP",
    label: "Optional Monthly Membership",
    shares: [
      { recipient: "SUR Account", ...treasuryAccounts.SUR_BDO, percent: 50 },
      { recipient: "TDI Account", ...treasuryAccounts.TDI_SHARE, percent: 30 },
      { recipient: "JStudios and Events", ...treasuryAccounts.JSTUDIOS_EVENTS, percent: 20 },
    ],
  },
  OPTIONAL_ONE_TIME_MEMBERSHIP: {
    key: "OPTIONAL_ONE_TIME_MEMBERSHIP",
    label: "Optional One-Time Membership",
    shares: [
      { recipient: "SUR Aloeswood Corporation", ...treasuryAccounts.SUR_BDO, percent: 80 },
      { recipient: "TDI Technological Digital Innovation", ...treasuryAccounts.TDI_SHARE, percent: 6 },
      { recipient: "JStudios and Events Management Services", ...treasuryAccounts.JSTUDIOS_EVENTS, percent: 4 },
      { recipient: "Direct Commission / Referral", accountProvider: "Internal Ledger", accountName: "Qualified Referrer", accountNumber: "REFERRAL_LEDGER", percent: 10 },
    ],
  },
  TREE_SAVE_LIFE_DONATION: {
    key: "TREE_SAVE_LIFE_DONATION",
    label: "Tree Save Life Donation",
    shares: [
      { recipient: "JStudios and Events Management Services", ...treasuryAccounts.JSTUDIOS_EVENTS, percent: 50 },
      { recipient: "TDI Technological Digital Innovation", ...treasuryAccounts.TDI_SHARE, percent: 25 },
      { recipient: "Direct Marketing and Sales Commission", accountProvider: "Internal Ledger", accountName: "Marketing Source", accountNumber: "MARKETING_LEDGER", percent: 25 },
    ],
  },
  PROGRAM_SERVICE: {
    key: "PROGRAM_SERVICE",
    label: "Program Service",
    shares: [
      { recipient: "SUR Aloeswood Corporation", ...treasuryAccounts.SUR_BDO, percent: 70 },
      { recipient: "TDI Technological Digital Innovation", ...treasuryAccounts.TDI_SHARE, percent: 20 },
      { recipient: "JStudios and Events Management Services", ...treasuryAccounts.JSTUDIOS_EVENTS, percent: 10 },
    ],
  },
};

export function calculateDistribution(ruleKey: DistributionRuleKey, grossAmount: number) {
  const rule = feeDistributionRules[ruleKey];
  const gross = Number(grossAmount || 0);
  let allocated = 0;

  const shares = rule.shares.map((share, index) => {
    const amount =
      index === rule.shares.length - 1
        ? roundMoney(gross - allocated)
        : roundMoney((gross * share.percent) / 100);
    allocated += amount;
    return { ...share, amount };
  });

  return { rule, gross, shares };
}

export function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}
