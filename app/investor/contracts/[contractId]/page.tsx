import ContractSigning from "@/app/components/ContractSigning";

export default async function TreeContractPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <ContractSigning contractId={contractId} />;
}
