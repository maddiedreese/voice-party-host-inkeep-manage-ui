'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchProjectAction } from '@/lib/actions/projects';
import type { Project } from '@/lib/types/project';

export function useProjectData() {
  const params = useParams();
  const { tenantId, projectId } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!tenantId || !projectId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Use server action to fetch project data
        const result = await fetchProjectAction(tenantId as string, projectId as string);

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch project');
        }

        setProject(result.data || null);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setProject(null);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [tenantId, projectId]);

  return { project, loading, error };
}
