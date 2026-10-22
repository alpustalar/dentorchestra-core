const appointment = {
  AppointmentCalendar: {
    title: 'Calendar',
    time: 'Time',
    enableHandles: 'Edit by dragging',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    slotDuration: 'Slot duration',
    slotDurationOption: '{minutes} minutes',
    patientHidden: 'Patient details hidden',
    saving: 'Saving appointment times…',
    resizeSuccess: 'Appointment times updated.',
    resizeError: 'Could not save the times. The previous times were restored.',
    resizeConflict:
      'The times conflict or the record changed. The calendar was reloaded.',
    loadError: 'Appointments could not be loaded. Use Refresh to try again.',
    loading: 'Loading appointments…',
    currentClinic: 'Active clinic',
    allProviders: 'All providers',
    noSelection: 'Select a time range on the calendar.',
    selectionHint:
      'Select a range; drag its edges to adjust in {step}-minute steps.',
    selectedRange: '{date} · {start}–{end} · {minutes} min',
    selectRange: 'Select {start}–{end} on {day}',
    clearSelection: 'Clear selection',
    confirmSelection: 'Confirm selection and open appointment form',
    appointmentDetailsDescription:
      'Appointment details and available next actions.',
    rangeFormDescription:
      'The selected date and time range have been copied to the form.',
    createAppointment: 'New appointment',
    resizeStart: 'Adjust the selected range start',
    resizeEnd: 'Adjust the selected range end',
    startTime: 'Start time',
    durationMinutes: 'Duration (minutes)',
  },
  AppointmentDetails: {
    timeZone: 'Europe/Istanbul',
    doctor: 'Doctor',
    clinic: 'Clinic',
    treatment: 'Treatment',
    status: 'Status',
    actions: {
      edit: 'Edit',
      checkIn: 'Check-in',
    },
    statuses: {
      SCHEDULED: 'Scheduled',
      CONFIRMED: 'Confirmed',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      IN_PROGRESS: 'In Progress',
    },
  },
} as const;

export default appointment;
