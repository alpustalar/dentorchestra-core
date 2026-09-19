import { createZodDto } from 'nestjs-zod';
import { BookFlightSchema } from '../../schemas/commands/book-flight.schema';

export class BookFlightDto extends createZodDto(BookFlightSchema) {}
