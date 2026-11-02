
export class ProductResponseDto {
  id!: string;
  name!: string;
  description!: string;
  price!: number;
  imageUrl!: string;
  stock!: number;
}

export class ApiResponseDto<T> {
  success!: boolean;
  message!: string;
  data!: T;
}
