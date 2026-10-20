import { STATIC_PRISMA_MODELS } from '../generated-capabilities';
import { capabilityHelper, ModelCapabilities } from '../utils';
import { MODULE_LABELS } from '../constants';

type PrismaModelName = (typeof STATIC_PRISMA_MODELS)[number];

const MONGOOSE_MODELS = ['AuditLog'] as const;
type MongooseModelName = (typeof MONGOOSE_MODELS)[number];

const VIRTUAL_MODULES = ['Finance'] as const;
type VirtualModuleName = (typeof VIRTUAL_MODULES)[number];

type AllModels = PrismaModelName | MongooseModelName | VirtualModuleName;
type CapabilityKeys = `${Uppercase<AllModels>}`;

export type CapabilitiesType = {
  [K in CapabilityKeys]: ModelCapabilities;
};

const allModelsList = [
  ...STATIC_PRISMA_MODELS,
  ...MONGOOSE_MODELS,
  ...VIRTUAL_MODULES,
];

export const CAPABILITIES = allModelsList.reduce((acc, model) => {
  const key = model.toUpperCase() as CapabilityKeys;
  acc[key] = capabilityHelper(model);
  return acc;
}, {} as CapabilitiesType);

export const capabilitiesCreateManyInputs = Object.values(CAPABILITIES).flatMap(
  (modelCaps) => Object.values(modelCaps)
);

export const capabilityModulesWithoutLabel = allModelsList
  .map((model) => model.toLowerCase())
  .filter((module) => !(module in MODULE_LABELS));
