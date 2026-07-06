export const COPLANTER_PACKAGE_PRICE = 25000;
export const PLANTATION_FUND_ALLOCATION = 10000;
export const FINTECH_DEVELOPMENT_ALLOCATION = 10000;
export const MARKETING_NETWORK_ALLOCATION = 5000;
export const DIRECT_REFERRAL_INCENTIVE = 3000;
export const RECOVERY_FUND_ALLOCATION = 2000;
export const RECOVERY_FUND_MAXIMUM = 50000;
export const ANNUAL_MAINTENANCE_FEE = 1500;
export const MAINTENANCE_YEARS = 4;
export const TOTAL_MAINTENANCE_FUND = ANNUAL_MAINTENANCE_FEE * MAINTENANCE_YEARS;
export const COPLANTER_HARVEST_SHARE = 70;
export const COMPANY_HARVEST_SHARE = 30;
export const PROJECTED_TARGET_VALUE = 450000;
export const PLATFORM_OPERATOR_LABEL = "Platform Operator";

export type AllocationItem = {
  label: string;
  amount: number;
  note: string;
};

export const capitalAllocation: AllocationItem[] = [
  {
    label: "Agarwood Plantation Fund",
    amount: PLANTATION_FUND_ALLOCATION,
    note: "Recorded for the buyer/client plantation side.",
  },
  {
    label: "Fintech Development Fund",
    amount: FINTECH_DEVELOPMENT_ALLOCATION,
    note: "Recorded for platform and technology development.",
  },
  {
    label: "Direct Referral Incentive",
    amount: DIRECT_REFERRAL_INCENTIVE,
    note: "Credited after full payment, qualification, and KYC approval.",
  },
  {
    label: "Recovery Fund Pool",
    amount: RECOVERY_FUND_ALLOCATION,
    note: "Used only under the recovery/termination policy.",
  },
];

export function peso(value: number | string | null | undefined) {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function packagePriceForQuantity(quantity: number) {
  return COPLANTER_PACKAGE_PRICE * quantity;
}

export function projectedDailyCareBudget(years: number) {
  const days = Math.max(1, Math.round(years * 365));
  return PROJECTED_TARGET_VALUE / days;
}

export const platformMoneyNotice =
  "This platform records ledger activity and operational approvals. Actual funds are sent through the buyer/client's own bank, GCash, Maya, or approved payment channels.";

export const projectionDisclaimer =
  "Projected values are estimates only and are not guaranteed returns, deposits, savings, or lending products. Actual outcomes depend on plantation performance, inoculation, harvest results, market prices, costs, taxes, and applicable regulations.";

export const recoveryTerminationNotice =
  "Recovery Fund withdrawal is treated as voluntary contract termination. Once approved, the package exits the 70/30 harvest participation and is settled under the company's 50/50 plantation-tech termination policy.";
