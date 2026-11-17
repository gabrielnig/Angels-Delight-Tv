import { useEffect, useRef, type RefObject } from 'react';

/** After a failed submit, move focus to the first invalid field once React has rendered the errors. */
export function useFocusFirstInvalid(formRef: RefObject<HTMLFormElement | null>) {
  const pending = useRef(false);
  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
  return () => {
    pending.current = true;
  };
}
