/** Normalize capability values to the `module:action` form used by the UI. */
export function formatCapabilityToString(capability: unknown): string {
  if (typeof capability === 'string') return capability;
  if (
    capability &&
    typeof capability === 'object' &&
    'module' in capability &&
    'action' in capability
  ) {
    return `${String(capability.module)}:${String(capability.action)}`;
  }
  return String(capability);
}
