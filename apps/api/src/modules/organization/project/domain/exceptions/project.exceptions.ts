import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../../../../../../../../packages/shared/common/constants/error-codes.constant';
import { DomainException } from '@src/domain/exceptions/domain.exception';
import type { ProjectAllocationConflictMeta } from '@shared/modules/project/interfaces';

export class ProjectNotFoundException extends DomainException<{
  projectId?: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(projectId?: string) {
    super('Proje bulunamadı.', { projectId });
  }
}

/** Durum makinesinin izin vermediği geçiş (ör. tamamlanmış projeyi askıya alma). */
export class ProjectInvalidStateException extends DomainException<{
  projectId: string;
  currentStatus: string;
  attempted: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.INVALID_STATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(projectId: string, currentStatus: string, attempted: string) {
    super(
      `Proje "${currentStatus}" durumundayken bu işlem yapılamaz (${attempted}).`,
      { projectId, currentStatus, attempted }
    );
  }
}

export class ProjectCodeTakenException extends DomainException<{
  code: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.CODE_TAKEN;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(code: string) {
    super(`"${code}" proje kodu bu klinikte zaten kullanılıyor.`, { code });
  }
}

export class ProjectPhaseNotFoundException extends DomainException<{
  phaseId?: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.PHASE_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(phaseId?: string) {
    super('Proje aşaması bulunamadı.', { phaseId });
  }
}

export class ProjectPhaseOrderTakenException extends DomainException<{
  projectId: string;
  order: number;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.PHASE_ORDER_TAKEN;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(projectId: string, order: number) {
    super(`Bu projede ${order}. sırada zaten bir aşama var.`, {
      projectId,
      order,
    });
  }
}

/** Görev/maliyet, başka bir projenin aşamasına bağlanmaya çalışıldı. */
export class ProjectPhaseMismatchException extends DomainException<{
  phaseId: string;
  projectId: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.PHASE_PROJECT_MISMATCH;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(phaseId: string, projectId: string) {
    super('Seçilen aşama bu projeye ait değil.', { phaseId, projectId });
  }
}

export class ProjectTaskNotFoundException extends DomainException<{
  taskId?: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.TASK_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(taskId?: string) {
    super('Görev bulunamadı.', { taskId });
  }
}

export class ProjectTaskInvalidStateException extends DomainException<{
  taskId: string;
  currentStatus: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.TASK_INVALID_STATE;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(taskId: string, currentStatus: string) {
    super(`Görev "${currentStatus}" durumundayken bu işlem yapılamaz.`, {
      taskId,
      currentStatus,
    });
  }
}

export class ProjectCostAlreadyLinkedException extends DomainException<{
  projectId: string;
  sourceRefId: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.COST_ALREADY_LINKED;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(projectId: string, sourceRefId: string) {
    super('Bu kayıt projeye zaten maliyet olarak eklenmiş.', {
      projectId,
      sourceRefId,
    });
  }
}

export class ProjectAllocationNotFoundException extends DomainException<{
  allocationId?: string;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.ALLOCATION_NOT_FOUND;
  public override readonly httpStatus = HttpStatus.NOT_FOUND;

  constructor(allocationId?: string) {
    super('Kaynak tahsisi bulunamadı.', { allocationId });
  }
}

export class ProjectAllocationInvalidRangeException extends DomainException<{
  startDate: Date;
  endDate: Date;
}> {
  readonly errorCode = ERROR_CODES.PROJECT.ALLOCATION_INVALID_RANGE;

  constructor(startDate: Date, endDate: Date) {
    super('Tahsis bitiş tarihi başlangıçtan önce olamaz.', {
      startDate,
      endDate,
    });
  }
}

/**
 * Kapasite aşımı. `meta` çakışan tahsisleri taşır ki frontend "kim/hangi proje
 * doldurmuş" listesini kullanıcıya gösterebilsin.
 */
export class ProjectAllocationConflictException extends DomainException<ProjectAllocationConflictMeta> {
  readonly errorCode = ERROR_CODES.PROJECT.ALLOCATION_CONFLICT;
  public override readonly httpStatus = HttpStatus.CONFLICT;

  constructor(meta: ProjectAllocationConflictMeta, message?: string) {
    super(
      message ??
        `Kaynak bu tarih aralığında dolu (mevcut tahsis %${meta.allocatedPercent}, istenen %${meta.requestedPercent}).`,
      meta
    );
  }
}
