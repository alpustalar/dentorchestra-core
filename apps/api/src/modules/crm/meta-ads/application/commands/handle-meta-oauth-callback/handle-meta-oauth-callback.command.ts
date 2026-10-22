import { ICommand } from '@nestjs/cqrs';
import { HandleMetaOAuthCallbackResponse } from './handle-meta-oauth-callback.response';

export class HandleMetaOAuthCallbackCommand implements ICommand {
  readonly __responseType!: HandleMetaOAuthCallbackResponse;

  constructor(
    public readonly code: string,
    public readonly state: string
  ) {}
}
