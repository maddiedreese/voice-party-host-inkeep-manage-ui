import { useReactFlow } from '@xyflow/react';
import { useCallback, useRef } from 'react';
import { useGraphStore } from '@/features/graph/state/use-graph-store';
import type { ErrorHelpers } from './use-graph-errors';

interface UseNodeEditorOptions {
  selectedNodeId: string;
  errorHelpers?: ErrorHelpers;
}

export function useNodeEditor({ selectedNodeId, errorHelpers }: UseNodeEditorOptions) {
  const { updateNodeData } = useReactFlow();
  const markUnsaved = useGraphStore((state) => state.markUnsaved);

  // Focus management for error fields
  const fieldRefs = useRef<Record<string, HTMLElement>>({});

  const setFieldRef = useCallback((fieldName: string, element: HTMLElement | null) => {
    if (element) {
      fieldRefs.current[fieldName] = element;
    } else {
      delete fieldRefs.current[fieldName];
    }
  }, []);

  // Focus on first error field when component mounts or errors change -- this was causing issues if another input was already focused
  // useEffect(() => {
  // 	if (errorHelpers) {
  // 		const firstErrorField = errorHelpers.getFirstErrorField();
  // 		if (firstErrorField && fieldRefs.current[firstErrorField]) {
  // 			// Small delay to ensure the element is rendered
  // 			setTimeout(() => {
  // 				fieldRefs.current[firstErrorField].focus();
  // 			}, 100);
  // 		}
  // 	}
  // }, [errorHelpers]);

  // Helper function to get field error message
  const getFieldError = useCallback(
    (fieldName: string) => {
      return errorHelpers?.getFieldErrorMessage(fieldName);
    },
    [errorHelpers]
  );

  // Simple field update
  const updateField = useCallback(
    (name: string, value: any) => {
      updateNodeData(selectedNodeId, { [name]: value });
      markUnsaved();
    },
    [selectedNodeId, updateNodeData, markUnsaved]
  );

  // Handle input change events
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      updateField(name, value);
    },
    [updateField]
  );

  // Advanced path-based updates for nested objects
  const updatePath = useCallback(
    (path: string, value: any) => {
      const pathParts = path.split('.');

      if (pathParts.length === 1) {
        updateField(path, value);
      } else {
        // For nested updates, we need to get the current node data
        // This requires access to the current node data, which we'll need to pass in
        // For now, let's use the simple updateField approach and handle complex cases separately
        updateField(path, value);
      }
    },
    [updateField]
  );

  // Enhanced updatePath that can handle nested objects
  const updateNestedPath = useCallback(
    (path: string, value: any, currentNodeData: any) => {
      const pathParts = path.split('.');

      if (pathParts.length === 1) {
        updateField(path, value);
      } else {
        const [parentField, ...nestedPath] = pathParts;
        // Ensure we have a valid parent object, even if it's empty
        const currentParentValue = currentNodeData?.[parentField] || {};

        const updatedParent = { ...currentParentValue } as any;
        let current = updatedParent;

        // Navigate to the correct nested location
        for (let i = 0; i < nestedPath.length - 1; i++) {
          const key = nestedPath[i];
          if (!(key in current) || current[key] === null || current[key] === undefined) {
            current[key] = {};
          }
          current = current[key];
        }

        // Set the final value
        const finalKey = nestedPath[nestedPath.length - 1];
        if (value === undefined || value === null || value === '') {
          delete current[finalKey];
          // If the parent object becomes empty, clean it up
          if (Object.keys(updatedParent).length === 0 || Object.keys(current).length === 0) {
            updateField(parentField, null);
            return;
          }
        } else {
          current[finalKey] = value;
        }

        updateField(parentField, updatedParent);
      }
    },
    [updateField]
  );

  return {
    // Field management
    updateField,
    updatePath,
    updateNestedPath,
    handleInputChange,

    // Error handling
    getFieldError,

    // Focus management
    setFieldRef,

    // Utility
    markUnsaved,
  };
}
