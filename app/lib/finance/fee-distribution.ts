export type DistributionRuleKey =
  | "COPLANTER_PACKAGE"
  | "OPTIONAL_MONTHLY_MEMBERSHIP"
  | "OPTIONAL_ONE_TIME_MEMBERSHIP"
  | "TREE_SAVE_LIFE_DONATION"
  | "PROGRAM_SERVICE";

export type DistributionShare = {
  beneficiaryKey: string;
  recipient: string;
  purpose: string;
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

export type RevenueAllocationInput = {
  sourceType: string;
  sourceId?: string | null;
  paymentReference?: string | null;
  profileId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  grossAmount: number;
  earnedDate?: string | Date | null;
  ruleKey?: DistributionRuleKey;
};

export type PlatformFeeInput = {
  sourceType: string;
  sourceId?: string | null;
  paymentReference?: string | null;
  profileId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  grossAmount: number;
  feeAmount: number;
  earnedDate?: string | Date | null;
};

export const PLATFORM_FEE_RATE = 0.02;
export const PLATFORM_FEE_MINIMUM = 50;
export const PLATFORM_FEE_MAXIMUM = 500;

export const treasuryAccounts = {
  SUR_OPERATING: {
    beneficiaryKey: "SUR_OPERATING",
    recipient: "SUR Aloeswood Corporation",
    purpose: "Corporate Operations & Plantation Development",
    accountProvider: "BDO",
    accountName: "Donnabel Cabrido",
    accountNumber: "010148009036",
    percent: 60,
  },
  TDI_REVENUE: {
    beneficiaryKey: "TDI_REVENUE",
    recipient: "TDI Technological Digital Innovation",
    purpose: "Technology Development, Software Maintenance & System Operations",
    accountProvider: "UnionBank",
    accountName: "Janica Manansala Maldives",
    accountNumber: "103200012264",
    percent: 10,
  },
  MARKETING_LUZON_ABROAD: {
    beneficiaryKey: "MARKETING_LUZON_ABROAD",
    recipient: "Marketing & Sales (Luzon and Abroad)",
    purpose: "Marketing, Sales, Business Development & Client Acquisition - Luzon and Abroad",
    accountProvider: "Security Bank",
    accountName: "Antonio Junior Coral",
    accountNumber: "0000065356663",
    percent: 10,
  },
  MARKETING_VISMIN: {
    beneficiaryKey: "MARKETING_VISMIN",
    recipient: "Rozendale Vale Repolidon",
    purpose: "Marketing, Sales, Business Development & Client Acquisition - Visayas and Mindanao",
    accountProvider: "UnionBank",
    accountName: "Rozendale Vale Repolidon",
    accountNumber: "1093 3005 6759",
    percent: 10,
  },
  JSTUDIOS_EVENTS: {
    beneficiaryKey: "JSTUDIOS_EVENTS",
    recipient: "JStudios and Events Management Services",
    purpose: "Media Production, Branding, Events, Marketing Content & Creative Services",
    accountProvider: "BDO Network Bank",
    accountName: "JStudios and Events Management Services",
    accountNumber: "040270347437",
    percent: 10,
  },
};

const standardRevenueShares = [
  treasuryAccounts.SUR_OPERATING,
  treasuryAccounts.TDI_REVENUE,
  treasuryAccounts.MARKETING_LUZON_ABROAD,
  treasuryAccounts.MARKETING_VISMIN,
  treasuryAccounts.JSTUDIOS_EVENTS,
];

export const feeDistributionRules: Record<DistributionRuleKey, DistributionRule> = {
  COPLANTER_PACKAGE: {
    key: "COPLANTER_PACKAGE",
    label: "Co-Planter Package",
    shares: standardRevenueShares,
  },
  OPTIONAL_MONTHLY_MEMBERSHIP: {
    key: "OPTIONAL_MONTHLY_MEMBERSHIP",
    label: "Optional Monthly Membership",
    shares: standardRevenueShares,
  },
  OPTIONAL_ONE_TIME_MEMBERSHIP: {
    key: "OPTIONAL_ONE_TIME_MEMBERSHIP",
    label: "Optional One-Time Membership",
    shares: standardRevenueShares,
  },
  TREE_SAVE_LIFE_DONATION: {
    key: "TREE_SAVE_LIFE_DONATION",
    label: "Tree Save Life Donation",
    shares: standardRevenueShares,
  },
  PROGRAM_SERVICE: {
    key: "PROGRAM_SERVICE",
    label: "Program Service",
    shares: standardRevenueShares,
  },
};

export const settlementStatuses = [
  "PENDING_SETTLEMENT",
  "READY_FOR_PAYOUT",
  "PARTIALLY_SETTLED",
  "SETTLED",
  "ON_HOLD",
  "FAILED",
];

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

export function buildRevenueAllocationRows(input: RevenueAllocationInput) {
  const earnedDate = normalizeDate(input.earnedDate);
  const distribution = calculateDistribution(input.ruleKey || "COPLANTER_PACKAGE", input.grossAmount);

  return distribution.shares.map((share) => ({
    source_type: input.sourceType,
    source_id: input.sourceId || null,
    payment_reference: input.paymentReference || null,
    profile_id: input.profileId || null,
    customer_name: input.customerName || null,
    customer_email: input.customerEmail || null,
    gross_amount: distribution.gross,
    beneficiary_key: share.beneficiaryKey,
    beneficiary_name: share.recipient,
    beneficiary_purpose: share.purpose,
    bank_name: share.accountProvider,
    account_name: share.accountName,
    account_number: share.accountNumber,
    allocation_percent: share.percent,
    allocated_amount: share.amount,
    earned_date: earnedDate,
    payout_month: earnedDate.slice(0, 7),
    settlement_status: "PENDING_SETTLEMENT",
  }));
}

export function calculatePlatformFee(grossAmount: number) {
  const gross = Number(grossAmount || 0);
  if (gross <= 0) return { gross, fee: 0, net: 0, rate: PLATFORM_FEE_RATE };
  const fee = roundMoney(Math.min(PLATFORM_FEE_MAXIMUM, Math.max(PLATFORM_FEE_MINIMUM, gross * PLATFORM_FEE_RATE)));
  return { gross, fee, net: roundMoney(gross - fee), rate: PLATFORM_FEE_RATE };
}

export function buildTdiPlatformFeeAllocationRows(input: PlatformFeeInput) {
  const earnedDate = normalizeDate(input.earnedDate);
  const fee = roundMoney(input.feeAmount);
  const tdi = treasuryAccounts.TDI_REVENUE;

  if (fee <= 0) return [];

  return [
    {
      source_type: input.sourceType,
      source_id: input.sourceId || null,
      payment_reference: input.paymentReference || null,
      profile_id: input.profileId || null,
      customer_name: input.customerName || null,
      customer_email: input.customerEmail || null,
      gross_amount: roundMoney(input.grossAmount),
      beneficiary_key: tdi.beneficiaryKey,
      beneficiary_name: tdi.recipient,
      beneficiary_purpose: "Platform Fee - Technology Development, Software Maintenance & System Operations",
      bank_name: tdi.accountProvider,
      account_name: tdi.accountName,
      account_number: tdi.accountNumber,
      allocation_percent: 100,
      allocated_amount: fee,
      earned_date: earnedDate,
      payout_month: earnedDate.slice(0, 7),
      settlement_status: "PENDING_SETTLEMENT",
    },
  ];
}

export function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeDate(value?: string | Date | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}
