import {
  CallHandler,
  ExecutionContext,
  Global,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ExecutionSources } from '../../../../../../packages/shared/common/constants/execution-source.constant';

@Global()
@Injectable()
export class ExecutionSourceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Express.Request>();

    if (!request['executionSource']) {
      request['executionSource'] = ExecutionSources.USER_ACTION;
    }

    return next.handle();
  }
}
