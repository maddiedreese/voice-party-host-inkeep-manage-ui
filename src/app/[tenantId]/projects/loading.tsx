import { BodyTemplate } from '@/components/layout/body-template';
import { MainContent } from '@/components/layout/main-content';
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { projectDescription } from '@/constants/page-descriptions';

export default function Loading() {
  return (
    <BodyTemplate breadcrumbs={[{ label: 'Projects' }]}>
      <MainContent>
        <PageHeader title="Projects" description={projectDescription} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`loading-skeleton-${i}`} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      </MainContent>
    </BodyTemplate>
  );
}
