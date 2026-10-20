/* eslint-disable */

import {
  CRUD_ACTION_LABELS,
  CRUD_ACTIONS,
  CrudAction,
  MODULE_LABELS,
} from '../constants';

const rawActions: any = {};
CRUD_ACTIONS.forEach((action) => {
  rawActions[action] = action;
});
export const ACTIONS = rawActions as Record<CrudAction, CrudAction>;

export type Capability<A> = {
  module: string;
  action: A;
  name: string;
};
export type ModelCapabilities = {
  [A in CrudAction]: Capability<A>;
};

export const capabilityHelper = (model: string): ModelCapabilities => {
  const module = model.toLowerCase();
  const caps: any = {};

  CRUD_ACTIONS.forEach((action) => {
    const moduleLabel = MODULE_LABELS[module] ?? module;
    const actionLabel = CRUD_ACTION_LABELS[action] ?? action;

    caps[action] = { module, action, name: `${moduleLabel} ${actionLabel}` };
  });

  return caps as ModelCapabilities;
};
