// Mirrors the API's StudentDto (server/Server.Api/Models/Dto/StudentDto.cs), with camelCase JSON
export interface Student {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly course: string;
  readonly year: number;
  readonly isActive: boolean;
}
