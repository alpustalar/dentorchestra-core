import {
  JournalEntry as IJournalEntry,
  JournalEntryStatusSchema,
  JournalLine as IJournalLine,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { JournalLine } from './journal-line.entity';
import { JournalEntrySequence } from '@modules/finance/shared/domain/value-objects/journal-entry-sequence.vo';
import { JournalLines } from '@modules/finance/accounting/posting/domain/value-objects/journal-lines.vo';
import {
  JournalEntryAlreadyReversedException,
  JournalEntryNonPositiveTotalException,
  JournalEntryNotDraftException,
  JournalEntryNotPostedException,
} from '@modules/finance/accounting/posting/domain/exceptions/journal-entry.exceptions';
import { JournalEntryStatusType as JournalEntryStatus } from '@input-type-schemas/JournalEntryStatusSchema';
import {
  JournalEntryKindSchema,
  JournalEntryKindType as JournalEntryKind,
} from '@input-type-schemas/JournalEntryKindSchema';
import {
  BuildReversalDraftProps,
  CreateJournalEntryProps,
  MarkReversedProps,
} from '@modules/finance/accounting/posting/domain/contracts/journal-entry';
import { JournalEntryReversedEvent } from '@modules/finance/accounting/posting/domain/events';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

/**
 * Yevmiye fişi (aggregate root). Satırlarını (JournalLine) içinde tutar.
 * Değişmez kural: POSTED olurken borç = alacak ve toplam > 0.
 */
export class JournalEntry extends AggregateRoot {
  constructor(data: IJournalEntry, lines: JournalLine[] = []) {
    super();
    this._id = data.id;
    this._organizationId = data.organizationId;
    this._clinicId = data.clinicId;
    this._periodId = data.periodId;

    // Yevmiye sıra numarasını VO ile koruyoruz. VO en az 3 karakter ister; sıra no
    // DB'de bigint (1,2,3...) saklandığından 3 haneye sıfırla doldurulur ('001').
    this._entryNo = data.entryNo
      ? JournalEntrySequence.fromSequence(data.entryNo)
      : null;
    this._entryDate = data.entryDate;

    this._description = data.description;

    this._status = data.status;
    this._kind = data.kind;
    this._eventId = data.eventId;
    this._reversedById = data.reversedById;
    this._performedById = data.performedById;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._lines = new JournalLines(lines);
  }

  private _id: string;
  get id(): string {
    return this._id;
  }

  private _organizationId: string;
  get organizationId(): string {
    return this._organizationId;
  }

  private _clinicId: string;
  get clinicId(): string {
    return this._clinicId;
  }

  private _periodId: string;
  get periodId(): string {
    return this._periodId;
  }

  private _entryNo: JournalEntrySequence | null;
  get entryNo(): JournalEntrySequence | null {
    return this._entryNo;
  }

  private _entryDate: Date;
  get entryDate(): Date {
    return this._entryDate;
  }

  private _description: string | null;
  get description(): string | null {
    return this._description;
  }

  private _status: JournalEntryStatus;
  get status(): JournalEntryStatus {
    return this._status;
  }

  private _kind: JournalEntryKind;
  get kind(): JournalEntryKind {
    return this._kind;
  }

  private _eventId: string | null;
  get eventId(): string | null {
    return this._eventId;
  }

  private _reversedById: string | null;
  get reversedById(): string | null {
    return this._reversedById;
  }

  private _performedById: string | null;
  get performedById(): string | null {
    return this._performedById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _lines: JournalLines;
  get lines(): JournalLines {
    return this._lines;
  }

  public get totalDebit() {
    return this._lines.totalDebit;
  }

  public get totalCredit() {
    return this._lines.totalCredit;
  }

  public get isBalanced(): boolean {
    return this._lines.isBalanced;
  }

  public static createDraft(props: CreateJournalEntryProps): JournalEntry {
    const id = UUID.createOrGenerate(props.id).value;
    const lines = props.lines.map((line) => JournalLine.create(id, line));

    const entry = new JournalEntry(
      {
        id,
        organizationId: props.organizationId,
        clinicId: props.clinicId,
        periodId: props.periodId,
        entryNo: null,
        entryDate: props.entryDate,
        description: props.description ?? null, // Saf string mapping
        status: JournalEntryStatusSchema.enum.DRAFT,
        kind: props.kind ?? JournalEntryKindSchema.enum.OPERATIONAL,
        eventId: props.eventId ?? null,
        reversedById: null,
        performedById: props.performedById ?? null,
        createdAt: DateTimeManager.create(),
        updatedAt: DateTimeManager.create(),
      },
      lines
    );

    entry.validateStructure();
    return entry;
  }

  /** Denge ve yapısal aggregate invariant'larını doğrular. */
  public validateStructure(): void {
    // Koleksiyon VO'nun sunduğu metodlar ile doğrulama
    this._lines.validateBalance();

    if (this.totalDebit.lte(0)) {
      throw new JournalEntryNonPositiveTotalException();
    }
  }

  /** Taslak fişi POSTED yapar ve yevmiye sıra numarası atar. */
  public post(entryNo: bigint): void {
    if (this._status !== JournalEntryStatusSchema.enum.DRAFT) {
      throw new JournalEntryNotDraftException();
    }

    // Fişi POST etmeden önce son kez invariant kontrolü
    this.validateStructure();

    this._entryNo = JournalEntrySequence.fromSequence(entryNo);
    this._status = JournalEntryStatusSchema.enum.POSTED;
    this._updatedAt = DateTimeManager.create();
  }

  public isPosted(): boolean {
    return this._status === JournalEntryStatusSchema.enum.POSTED;
  }

  public isReversed(): boolean {
    return this._status === JournalEntryStatusSchema.enum.REVERSED;
  }

  /**
   * Bu fişin storno (ters kayıt) taslağını üretir: her satırın borç/alacağı yer
   * değiştirir. Storno yeni bir fiştir — kendi dönemine/numara akışına girer, eventId
   * taşımaz. Kilitli dönemdeki kaydı düzeltmenin tek yolu budur (doc 04, doc 08).
   */
  public buildReversalDraft(props: BuildReversalDraftProps): JournalEntry {
    this.ensureReversible();
    return JournalEntry.createDraft({
      id: props.reversalId,
      clinicId: this._clinicId,
      organizationId: this._organizationId,
      periodId: props.periodId,
      entryDate: props.entryDate,
      description:
        props.description ?? `Storno: ${this._description ?? this._id}`,
      eventId: null,
      // Nitelik DEVRALINIR. Bir kapanış fişinin stornosu OPERATIONAL olsaydı gelir
      // tablosuna ters işaretle girer ve kapanmış yılın cirosunu şişirirdi; ekonomik
      // bir fişin stornosu ise ekonomiktir — götürdüğü etki gelir tablosuna aittir.
      kind: this._kind,
      performedById: props.performedById ?? null,
      lines: this._lines.items.map((line) => ({
        accountId: line.accountId,
        partyId: line.partyId,
        // Ters kayıt: borç ↔ alacak yer değiştirir.
        debit: line.credit,
        credit: line.debit,
        // Para birimi orijinal satırdan taşınır. Geçilmezse `JournalLine.create`
        // TRY'ye düşerdi: fonksiyonel parası TRY olmayan bir defterde storno
        // satırları başka bir para biriminde damgalanır ve mizan iki farklı
        // para birimini aynı kolonda toplardı.
        currency: line.currency.value,
        // Yabancı para izi de terslenerek taşınır (orijinal tutar + aynı kur):
        // storno, orijinalin kur snapshot'ıyla kapatılmalıdır; bugünün kuruyla
        // kapatmak defterde gerçek olmayan bir kur farkı yaratır.
        originalDebit: line.originalCredit,
        originalCredit: line.originalDebit,
        originalCurrency: line.originalCurrency?.value ?? null,
        fxRate: line.fxRate,
        lineDesc: line.lineDesc,
      })),
    });
  }

  /**
   * Orijinal fişi REVERSED işaretler ve onu üreten storno fişine bağlar.
   *
   * Storno, defter üzerindeki en yüksek etkili **elle** işlemdir: mühürlenmiş bir
   * kaydın etkisini götürür. Bu yüzden "kim, ne zaman" iki yerde birden saklanır —
   * storno fişinin `performedById` kolonunda ve buradan doğan denetim olayında.
   */
  public markReversed(props: MarkReversedProps): void {
    this.ensureReversible();
    this._status = JournalEntryStatusSchema.enum.REVERSED;
    this._reversedById = props.reversalId;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new JournalEntryReversedEvent({
        entryId: this._id,
        reversalId: props.reversalId,
        clinicId: this._clinicId,
        organizationId: this._organizationId,
        periodId: this._periodId,
        entryNo: this._entryNo?.value ?? null,
        reason: props.reason ?? null,
        actorId: props.actorId,
        action: LogAction.JOURNAL_ENTRY_REVERSED,
        source: props.source ?? LogSource.SYSTEM,
        type: LogType.SECURITY,
      })
    );
  }

  public toPersistence(): IJournalEntry {
    return {
      id: this._id,
      organizationId: this._organizationId,
      clinicId: this._clinicId,
      periodId: this._periodId,
      entryNo: this._entryNo ? BigInt(this._entryNo.value) : null,
      entryDate: this._entryDate,
      description: this._description,
      status: this._status,
      kind: this._kind,
      eventId: this._eventId,
      reversedById: this._reversedById,
      performedById: this._performedById,
      createdAt: this._createdAt,
      // Saf okuma: iki çağrı aynı sonucu vermeli. `DateTimeManager.create()`
      // burada çağrılırsa entity'nin kendi `_updatedAt`'i hiç yazılmaz ve
      // "fiş ne zaman mühürlendi / ne zaman storno edildi" izi kaybolur.
      updatedAt: this._updatedAt,
    };
  }

  public linesToPersistence(): IJournalLine[] {
    return this._lines.toPersistence();
  }

  private ensureReversible(): void {
    // Sıra önemli: storno edilen fişin durumu REVERSED olduğu için `isPosted()`
    // kontrolü önce gelseydi ikinci storno denemesi "yalnızca POSTED fişler
    // storno edilebilir" derdi — doğru statü (409) ama yanlış gerekçe. Eşzamanlı
    // iki storno isteğinde ikinci istek tam buraya düşer; operatörün göreceği
    // mesaj "fiş zaten storno edilmiş" olmalıdır.
    if (this._reversedById || this.isReversed()) {
      throw new JournalEntryAlreadyReversedException();
    }
    if (!this.isPosted()) {
      throw new JournalEntryNotPostedException();
    }
  }
}
