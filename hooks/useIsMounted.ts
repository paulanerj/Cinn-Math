/**
 * @file useIsMounted.ts
 * @description A utility hook to safely check if a component is still mounted.
 * @purpose This hook is critical for preventing state updates on unmounted components, which would otherwise cause React warnings and potential memory leaks. This is especially important in async operations or long timeouts (like animation callbacks).
 * @ai-note Use this hook within any `setTimeout`, `setInterval`, or Promise `then()` block that updates component state to ensure the component hasn't been unmounted in the meantime.
 */
import React from 'react';
const { useRef, useEffect } = React;

export const useIsMounted = () => {
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    return isMountedRef;
};
