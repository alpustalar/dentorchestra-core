import { IBaseQueryRepository } from '@common/domain/repositories/base-query-repository.interface';
import { ProductCategory } from '@shared';
import { Paginated } from '@common/interfaces/paginated.type';

export interface IProductCategoryQueryRepository extends IBaseQueryRepository<ProductCategory> {
  findAll(): Promise<Paginated<ProductCategory>>;
}
