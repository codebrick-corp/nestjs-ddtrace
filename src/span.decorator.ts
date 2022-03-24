import { SetMetadata } from '@nestjs/common';
import { Constants } from './constants';

export const Span = (name?: string) =>
  SetMetadata(Constants.SPAN_METADATA, name);
