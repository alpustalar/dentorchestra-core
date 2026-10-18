import { checkQuoteOptionOwnership } from './quote-option-ownership.rule';
import { QuoteOptionOwner } from './quote-option.contracts';

const owner: QuoteOptionOwner = {
  clinicId: 'clinic-1',
  conversationId: 'conv-1',
};

describe('checkQuoteOptionOwnership', () => {
  it('aynı klinik + aynı görüşme → kabul', () => {
    expect(
      checkQuoteOptionOwnership({ stored: owner, claimed: { ...owner } })
    ).toBeNull();
  });

  it('başka kiracının teklifi → CLINIC_MISMATCH', () => {
    expect(
      checkQuoteOptionOwnership({
        stored: owner,
        claimed: { clinicId: 'clinic-2', conversationId: 'conv-1' },
      })
    ).toBe('CLINIC_MISMATCH');
  });

  it('aynı kiracı, başka görüşme → CONVERSATION_MISMATCH', () => {
    expect(
      checkQuoteOptionOwnership({
        stored: owner,
        claimed: { clinicId: 'clinic-1', conversationId: 'conv-2' },
      })
    ).toBe('CONVERSATION_MISMATCH');
  });

  /**
   * Personel ucu (HTTP) görüşme taşımaz: kliniğin kendi teklifini elle
   * tamamlaması meşru. İddia **daralabilir ama genişleyemez** — klinik her
   * zaman eşleşir.
   */
  it('görüşmesiz iddia (personel) → yalnız klinik eşleşmesi aranır', () => {
    expect(
      checkQuoteOptionOwnership({
        stored: owner,
        claimed: { clinicId: 'clinic-1', conversationId: null },
      })
    ).toBeNull();

    expect(
      checkQuoteOptionOwnership({
        stored: owner,
        claimed: { clinicId: 'clinic-2', conversationId: null },
      })
    ).toBe('CLINIC_MISMATCH');
  });

  describe('fail-closed', () => {
    it('sahip bilgisi hiç yoksa reddedilir', () => {
      expect(
        checkQuoteOptionOwnership({ stored: null, claimed: { ...owner } })
      ).toBe('OWNER_MISSING');
      expect(
        checkQuoteOptionOwnership({ stored: undefined, claimed: { ...owner } })
      ).toBe('OWNER_MISSING');
    });

    it('sahip bilgisi yarım (kural öncesi kayıt) reddedilir', () => {
      expect(
        checkQuoteOptionOwnership({
          stored: { clinicId: 'clinic-1', conversationId: '' },
          claimed: { ...owner },
        })
      ).toBe('OWNER_MISSING');
      expect(
        checkQuoteOptionOwnership({
          stored: { clinicId: '', conversationId: 'conv-1' },
          claimed: { ...owner },
        })
      ).toBe('OWNER_MISSING');
    });
  });
});
