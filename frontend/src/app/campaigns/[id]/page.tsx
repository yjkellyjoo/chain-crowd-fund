import { use } from 'react';
import ClientCampaignDetail from './ClientCampaignDetail';

export default function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params);
  return <ClientCampaignDetail params={resolvedParams} />;
} 