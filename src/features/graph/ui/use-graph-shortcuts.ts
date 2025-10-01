import { useCallback, useEffect } from 'react';
import { useGraphStore } from '@/features/graph/state/use-graph-store';

export function useGraphShortcuts() {
  const { undo, redo, deleteSelected } = useGraphStore();

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!(e.target as HTMLElement)?.classList.contains('react-flow__node')) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Let inputs handle backspace/delete
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            (target as any).isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          deleteSelected();
        }
      }
    },
    [undo, redo, deleteSelected]
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);
}
