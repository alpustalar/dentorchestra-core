const financeEDocument = {
  FinanceEDocument: {
    eyebrow: 'Finance · e-document operations',
    demoData: 'Demo data',
    title: 'E-document center',
    description:
      'Track the internal invoice state and the external e-document trace when the API makes it available.',
    noSession: 'Sign in to view e-documents.',
    noScope: 'No authorized organization and clinic scope is available.',
    totalLabel: 'Total document candidates',
    loadError: 'E-document source records could not be loaded.',
    integrationUnavailableTitle:
      'External e-document status is not published by the API yet',
    integrationUnavailableDescription:
      'Document type, provider status, UUID, download, and retry information are absent from the current web contract. Internal invoices are shown without assuming external delivery or offering unsupported actions.',
    unknown: 'Unknown',
    summary: {
      total: 'Total records',
      inProgress: 'In progress',
      delivered: 'Delivered',
      failed: 'Failed',
    },
    listTitle: 'Document records',
    listDescription:
      'Internal invoice and external e-document states are shown separately. Live external state appears only when published by the API.',
    searchPlaceholder: 'Search by invoice number',
    search: 'Search',
    loading: 'Loading document records…',
    empty: 'No document records were found for this clinic.',
    noResults: 'No document matched your search.',
    invoiceNumber: 'Invoice no.',
    issuedAt: 'Issue date',
    documentType: 'Document type',
    invoiceStatus: 'Internal invoice',
    eDocumentStatus: 'External e-document',
    amount: 'Amount',
    actions: 'Actions',
    view: 'View',
    unassigned: 'Number pending',
    notIssued: 'Not issued yet',
    masked: 'Not authorized to view',
    previous: 'Previous',
    next: 'Next',
    page: 'Page {page} of {totalPages}',
    detailTitle: 'E-document details',
    detailDescription:
      'Internal invoice and external provider trace remain separate.',
    detailLoading: 'Loading document details…',
    detailError: 'Document details could not be loaded.',
    grandTotal: 'Grand total',
    externalTraceTitle: 'External provider trace',
    uuid: 'E-document UUID',
    providerReference: 'Provider reference',
    notAvailable: 'Not available',
    detailUnavailable:
      "The current API response does not include this invoice's external e-document state, so send, download, and retry actions cannot be offered safely.",
    integration: {
      title: 'Integration settings',
      description:
        'Connect Nilvera for this clinic or let branches inherit the organization account.',
      configured: 'Connected',
      notConfigured: 'Not connected',
      scopeLabel: 'Configuration scope',
      scopeClinic: 'This clinic',
      scopeOrganization: 'Organization',
      noScope:
        'No authorized clinic scope is available for integration settings.',
      loading: 'Loading integration settings…',
      inheritedDescription:
        'This clinic uses the organization Nilvera connection. Saving a clinic-specific key overrides it.',
      emptyDescription:
        'There is no external e-document connection configured for this scope.',
      providerLabel: 'Provider',
      environmentLabel: 'Environment',
      credentialLabel: 'API key',
      maskedCredential: 'Stored securely',
      testStatusLabel: 'Connection status',
      lastTestedLabel: 'Last test',
      sourceLabel: 'Active scope',
      never: 'Not tested yet',
      testPassed: 'Connection verified',
      testFailed: 'Connection failed',
      notTested: 'Awaiting test',
      testConnection: 'Test connection',
      remove: 'Remove connection',
      confirmRemove: 'Confirm removal',
      connectTitle: 'Connect a Nilvera account',
      connectDescription:
        'Enter the API key issued by the Nilvera test or production environment.',
      rotateTitle: 'Update connection',
      rotateDescription:
        'Saving a new key replaces the previous one and resets the connection test result.',
      apiKeyLabel: 'New API key',
      apiKeyPlaceholder: 'At least 16 characters',
      apiKeyValidation: 'The API key must contain at least 16 characters.',
      securityNote:
        'The key is used only for delivery, stored encrypted, and never returned to this screen.',
      connect: 'Save connection',
      rotateCredential: 'Rotate key',
      saveSuccess: 'The Nilvera connection was saved.',
      testSuccess: 'The Nilvera connection was verified successfully.',
      removeSuccess: 'The e-document connection was removed.',
      operationError:
        'The operation could not be completed. Check your access and connection details.',
      readyDescription:
        'The connection is verified. New invoices in this scope can be delivered through Nilvera.',
      failedDescription:
        'The last connection test failed. Check the environment and API key, then try again.',
      environment: {
        TEST: 'Test',
        PRODUCTION: 'Production',
      },
    },
    documentTypes: {
      E_FATURA: 'E-Invoice',
      E_ARSIV: 'E-Archive',
      INTERNAL: 'Internal document',
      UNAVAILABLE: 'Not published',
    },
    invoiceStatuses: {
      PENDING: 'Pending',
      ISSUED: 'Issued',
      FAILED: 'Failed',
      CANCELLED: 'Cancelled',
    },
    eDocumentStatuses: {
      ACCEPTED: 'Accepted',
      FAILED: 'Failed',
      INTERNAL: 'Internal document',
      QUEUED: 'Queued',
      SENT: 'Sent',
      UNAVAILABLE: 'Not published',
    },
  },
} as const;

export default financeEDocument;
