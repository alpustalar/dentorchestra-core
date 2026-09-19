/**
 * AI araç adları — tek kaynak. Her araç stratejisi (handlers/*.tool.ts) `name` ve
 * `definition` getter'larında bu sabiti kullanır; registry adları buradan doğrular.
 *
 * NOT: Araçların LLM tanımları (description + inputSchema) artık burada TOPLANMAZ; her
 * araç kendi tanımını `definition` getter'ında taşır (co-located). Tüm tanımları
 * `AiToolRegistry.definitions()` toplar.
 */
export const AI_TOOL_NAMES = {
  GET_CLINIC_SERVICES: 'get_clinic_services',
  LIST_PROVIDERS: 'list_providers',
  GET_PROVIDER_DETAILS: 'get_provider_details',
  CHECK_PROVIDER_AVAILABILITY: 'check_provider_availability',
  SUGGEST_APPOINTMENT_SLOTS: 'suggest_appointment_slots',
  BOOK_APPOINTMENT: 'book_appointment',
  HANDOFF_TO_HUMAN: 'handoff_to_human',
  CANCEL_APPOINTMENT: 'cancel_appointment',
  RESCHEDULE_APPOINTMENT: 'reschedule_appointment',
  CONFIRM_APPOINTMENT: 'confirm_appointment',
  GET_PATIENT_APPOINTMENTS: 'get_patient_appointments',
  GET_PATIENT_PACKAGES: 'get_patient_packages',
  REGISTER_LEAD: 'register_lead',
  SEARCH_HOTELS: 'search_hotels',
  BOOK_HOTEL: 'book_hotel',
  GET_HOTEL_BOOKINGS: 'get_hotel_bookings',
  CANCEL_HOTEL_BOOKING: 'cancel_hotel_booking',
  SEARCH_TRANSFERS: 'search_transfers',
  BOOK_TRANSFER: 'book_transfer',
  GET_TRANSFER_BOOKINGS: 'get_transfer_bookings',
  CANCEL_TRANSFER_BOOKING: 'cancel_transfer_booking',
  SEARCH_FLIGHTS: 'search_flights',
  BOOK_FLIGHT: 'book_flight',
  GET_FLIGHT_BOOKINGS: 'get_flight_bookings',
  CANCEL_FLIGHT_BOOKING: 'cancel_flight_booking',
} as const;
