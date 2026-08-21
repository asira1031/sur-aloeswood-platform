import PublicTreeRecord from "@/app/components/PublicTreeRecord";

export default async function PublicTreePage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  return <PublicTreeRecord treeId={decodeURIComponent(treeId)} />;
}
