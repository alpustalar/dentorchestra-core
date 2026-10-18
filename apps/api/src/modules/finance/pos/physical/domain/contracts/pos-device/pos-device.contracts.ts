/**
 * PosDevice domain kontratları. Entity static `create()` girişi (Props) ve
 * PAX bağlantı bilgisini taşıyan yardımcı tip.
 */

interface CreatePosDeviceBaseProps {
  id?: string;
  clinicId: string;
  label: string;
}

/** PAX (POSLINK/TCP) cihazı — terminalId/merchantId/host/port zorunlu. */
export interface CreatePaxDeviceProps extends CreatePosDeviceBaseProps {
  provider: 'PAX';
  terminalId: string;
  merchantId: string;
  host: string;
  port: number;
  deviceUniqueId?: undefined;
}

/** iyzico Terminal (Host API) cihazı — yalnız deviceUniqueId zorunlu. */
export interface CreateIyzicoTerminalDeviceProps extends CreatePosDeviceBaseProps {
  provider: 'IYZICO_TERMINAL';
  deviceUniqueId: string;
  terminalId?: undefined;
  merchantId?: undefined;
  host?: undefined;
  port?: undefined;
}

/**
 * Sağlayıcıya göre daralan discriminated union (eski `z.discriminatedUnion('provider', ...)`
 * ile bire bir aynı şekil). HTTP sınırındaki `RegisterPosDeviceSchema` (superRefine ile)
 * sağlayıcıya göre zorunlu alanları zaten doğrular; handler DTO'yu bu kolonlardan birine
 * daraltarak entity'ye geçirir.
 */
export type CreatePosDeviceProps =
  | CreatePaxDeviceProps
  | CreateIyzicoTerminalDeviceProps;

/** Bir PAX cihazına TCP bağlanmak için gereken, null olmayan bağlantı bilgisi. */
export interface PaxConnection {
  host: string;
  port: number;
  terminalId: string;
  merchantId: string;
}
