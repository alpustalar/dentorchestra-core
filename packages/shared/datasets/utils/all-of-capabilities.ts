import { ModelCapabilities } from './capability-helper';
import { CrudAction } from '../constants';

export const allOfCapabilities = (
  modelCaps: ModelCapabilities,
  ...excludeActions: CrudAction[]
) => {
  const all = Object.values(modelCaps) as {
    module: string;
    action: CrudAction;
  }[];

  if (excludeActions.length === 0) return all;

  return all.filter((cap) => !excludeActions.includes(cap.action));
};
