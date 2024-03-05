import { SetMetadata } from '@nestjs/common';
import { Constants } from './constants';

export const NoSpan = () =>
	SetMetadata(Constants.NO_SPAN_METADATA, true);
